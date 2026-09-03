package com.nexus.enterprise;

import com.nexus.org.OrganizationController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestClient;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api")
public class EnterpriseController {
    private final JdbcTemplate db;
    private final OrganizationController orgs;
    private final String storageUrl;
    private final String storageKey;
    private final String storageBucket;
    private final String razorpayWebhookSecret;
    private final InvitationMailService mail;
    public EnterpriseController(JdbcTemplate db, OrganizationController orgs,
                                @Value("${SUPABASE_URL:}") String storageUrl,
                                @Value("${SUPABASE_SECRET_KEY:}") String storageKey,
                                @Value("${SUPABASE_STORAGE_BUCKET:nexus-files}") String storageBucket,
                                @Value("${RAZORPAY_WEBHOOK_SECRET:}") String razorpayWebhookSecret,
                                InvitationMailService mail) { this.db=db; this.orgs=orgs; this.storageUrl=storageUrl; this.storageKey=storageKey; this.storageBucket=storageBucket; this.razorpayWebhookSecret=razorpayWebhookSecret; this.mail=mail; }

    record CreateMeeting(@NotBlank String title, String roomName, OffsetDateTime scheduledAt, Integer durationMinutes, UUID teamId) {}
    record RoleChange(@NotBlank String role) {}
    @GetMapping("/orgs/{orgId}/members")
    public List<Map<String,Object>> members(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT u.id,u.email,u.name,m.role,m.created_at FROM org.memberships m JOIN nexus_auth.users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name",orgId); }

    @PatchMapping("/orgs/{orgId}/members/{userId}/role")
    public Map<String,Object> role(@PathVariable UUID orgId,@PathVariable UUID userId,@Valid @RequestBody RoleChange r,org.springframework.security.core.Authentication a) { admin(orgId,a); if(!Set.of("OWNER","ADMIN","MEMBER").contains(r.role())) throw new IllegalArgumentException("Unsupported role."); db.update("UPDATE org.memberships SET role=? WHERE organization_id=? AND user_id=?",r.role(),orgId,userId); audit(orgId,user(a),"membership.role_changed","membership",userId); return db.queryForMap("SELECT user_id,role FROM org.memberships WHERE organization_id=? AND user_id=?",orgId,userId); }

    @DeleteMapping("/orgs/{orgId}/members/{userId}")
    public void removeMember(@PathVariable UUID orgId,@PathVariable UUID userId,org.springframework.security.core.Authentication a) { admin(orgId,a); if(user(a).equals(userId)) throw new IllegalArgumentException("You cannot remove yourself."); db.update("DELETE FROM org.team_members WHERE user_id=? AND team_id IN (SELECT id FROM org.teams WHERE organization_id=?)",userId,orgId); db.update("DELETE FROM org.memberships WHERE organization_id=? AND user_id=?",orgId,userId); audit(orgId,user(a),"membership.removed","membership",userId); }

    @GetMapping("/orgs/{orgId}/meetings")
    public List<Map<String,Object>> meetings(@PathVariable UUID orgId,org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,title,room_name,scheduled_at,duration_minutes,status,team_id,created_by FROM meeting.meetings m WHERE organization_id=? AND deleted_at IS NULL AND (team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=m.team_id AND tm.user_id=?)) ORDER BY scheduled_at NULLS FIRST",orgId,user(a)); }

    @PostMapping("/orgs/{orgId}/meetings")
    public Map<String,Object> createMeeting(@PathVariable UUID orgId,@Valid @RequestBody CreateMeeting r,org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); team(orgId,r.teamId(),uid); UUID id=UUID.randomUUID(); String room=Objects.requireNonNullElse(r.roomName(),"nexus-"+id.toString().substring(0,12)); db.update("INSERT INTO meeting.meetings(id,organization_id,team_id,title,room_name,scheduled_at,duration_minutes,created_by) VALUES(?,?,?,?,?,?,?,?)",id,orgId,r.teamId(),r.title().trim(),room,r.scheduledAt(),Objects.requireNonNullElse(r.durationMinutes(),30),uid); audit(orgId,uid,"meeting.created","meeting",id); return db.queryForMap("SELECT id,title,room_name,scheduled_at,duration_minutes,status,team_id,created_by FROM meeting.meetings WHERE id=?",id); }

    @PostMapping(value="/orgs/{orgId}/files/upload", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@PathVariable UUID orgId,@RequestPart("file") MultipartFile file,@RequestParam(required=false) UUID teamId,@RequestParam(required=false) UUID folderId,org.springframework.security.core.Authentication a) throws java.io.IOException { UUID uid=user(a); member(orgId,a); team(orgId,teamId,uid); if(folderId!=null&&db.queryForObject("SELECT count(*) FROM nexus_storage.folders WHERE id=? AND organization_id=? AND deleted_at IS NULL",Integer.class,folderId,orgId)==0)throw new IllegalArgumentException("Folder does not belong to this workspace."); if(file.isEmpty()||file.getSize()>524288000L) throw new IllegalArgumentException("File is empty or exceeds the 500 MB limit."); if(storageUrl.isBlank()||storageKey.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Supabase Storage is not configured."); UUID id=UUID.randomUUID(); String safe=file.getOriginalFilename()==null?"upload":file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]","-"); String key=orgId+"/"+id+"/v1/"+safe; String mime=Objects.requireNonNullElse(file.getContentType(),"application/octet-stream"); putObject(key,mime,file.getBytes()); db.update("INSERT INTO nexus_storage.files(id,organization_id,team_id,folder_id,name,object_key,mime_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?,?,?)",id,orgId,teamId,folderId,safe,key,mime,file.getSize(),uid); db.update("INSERT INTO nexus_storage.file_versions(id,file_id,version_number,object_key,size_bytes,mime_type,created_by) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID(),id,1,key,file.getSize(),mime,uid); audit(orgId,uid,"file.uploaded","file",id); return db.queryForMap("SELECT id,name,object_key,mime_type,size_bytes,created_at,team_id,folder_id,current_version FROM nexus_storage.files WHERE id=?",id); }

    @PostMapping(value="/files/{id}/versions", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> uploadVersion(@PathVariable UUID id,@RequestPart("file") MultipartFile file,org.springframework.security.core.Authentication a) throws java.io.IOException {Map<String,Object> current=db.queryForMap("SELECT id,organization_id,name,current_version FROM nexus_storage.files WHERE id=? AND deleted_at IS NULL",id);UUID orgId=(UUID)current.get("organization_id"),uid=user(a);member(orgId,a);if(file.isEmpty()||file.getSize()>524288000L)throw new IllegalArgumentException("File is empty or exceeds the 500 MB limit.");int version=((Number)current.get("current_version")).intValue()+1;String safe=file.getOriginalFilename()==null?Objects.toString(current.get("name")):file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]","-");String key=orgId+"/"+id+"/v"+version+"/"+safe;String mime=Objects.requireNonNullElse(file.getContentType(),"application/octet-stream");putObject(key,mime,file.getBytes());db.update("INSERT INTO nexus_storage.file_versions(id,file_id,version_number,object_key,size_bytes,mime_type,created_by) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID(),id,version,key,file.getSize(),mime,uid);db.update("UPDATE nexus_storage.files SET name=?,object_key=?,mime_type=?,size_bytes=?,current_version=?,updated_at=now() WHERE id=?",safe,key,mime,file.getSize(),version,id);audit(orgId,uid,"file.version_uploaded","file",id);return db.queryForMap("SELECT id,name,mime_type,size_bytes,current_version,updated_at FROM nexus_storage.files WHERE id=?",id);}

    @GetMapping("/files/{id}/download")
    public Map<String,Object> download(@PathVariable UUID id, org.springframework.security.core.Authentication a) {
        Map<String,Object> file = db.queryForMap("SELECT id,organization_id,name,object_key,mime_type,size_bytes FROM nexus_storage.files WHERE id=? AND deleted_at IS NULL", id);
        UUID orgId = (UUID) file.get("organization_id"); member(orgId, a);
        if (storageUrl.isBlank() || storageKey.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Supabase Storage is not configured.");
        String endpoint = storageUrl.replaceAll("/$", "") + "/storage/v1/object/sign/" + storageBucket + "/" + file.get("object_key");
        Map<?,?> signed = RestClient.create().post().uri(endpoint).header("apikey", storageKey).header("Authorization", "Bearer " + storageKey).contentType(MediaType.APPLICATION_JSON).body(Map.of("expiresIn", 3600)).retrieve().body(Map.class);
        if (signed == null || signed.get("signedURL") == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY, "Storage could not create a download link.");
        return Map.of("name", file.get("name"), "mimeType", file.get("mime_type"), "sizeBytes", file.get("size_bytes"), "url", storageUrl.replaceAll("/$", "") + "/storage/v1" + signed.get("signedURL"));
    }

    @GetMapping("/public/shared-files/{token}")
    public Map<String,Object> sharedDownload(@PathVariable String token){Map<String,Object> file=db.queryForMap("SELECT f.name,f.mime_type,f.size_bytes,f.object_key,l.id link_id FROM nexus_storage.shared_links l JOIN nexus_storage.files f ON f.id=l.file_id WHERE l.token=? AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at>now()) AND (l.max_downloads IS NULL OR l.download_count<l.max_downloads) AND f.deleted_at IS NULL",token);if(storageUrl.isBlank()||storageKey.isBlank())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Supabase Storage is not configured.");String endpoint=storageUrl.replaceAll("/$","")+"/storage/v1/object/sign/"+storageBucket+"/"+file.get("object_key");Map<?,?> signed=RestClient.create().post().uri(endpoint).header("apikey",storageKey).header("Authorization","Bearer "+storageKey).contentType(MediaType.APPLICATION_JSON).body(Map.of("expiresIn",900)).retrieve().body(Map.class);if(signed==null||signed.get("signedURL")==null)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,"Storage could not create a shared link.");db.update("UPDATE nexus_storage.shared_links SET download_count=download_count+1 WHERE id=?",file.get("link_id"));return Map.of("name",file.get("name"),"mimeType",file.get("mime_type"),"sizeBytes",file.get("size_bytes"),"url",storageUrl.replaceAll("/$","")+"/storage/v1"+signed.get("signedURL"));}

    @PostMapping("/meetings/{id}/join")
    public Map<String,Object> joinMeeting(@PathVariable UUID id,org.springframework.security.core.Authentication a) { Map<String,Object> m=db.queryForMap("SELECT id,organization_id,room_name FROM meeting.meetings WHERE id=? AND deleted_at IS NULL",id); member((UUID)m.get("organization_id"),a); UUID uid=user(a); db.update("INSERT INTO meeting.participants(meeting_id,user_id,joined_at) VALUES(?,?,now()) ON CONFLICT(meeting_id,user_id) DO UPDATE SET joined_at=now(),left_at=NULL",id,uid); audit((UUID)m.get("organization_id"),uid,"meeting.joined","meeting",id); return Map.of("meetingId",id,"roomName",m.get("room_name")); }

    @GetMapping("/search")
    public Map<String,Object> search(@RequestParam String q, @RequestParam UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); String term="%"+q.trim().toLowerCase()+"%";UUID uid=user(a); return Map.of("tasks",db.queryForList("SELECT id,title,'task' type,'/tasks' href FROM project.tasks t WHERE organization_id=? AND deleted_at IS NULL AND lower(title) LIKE ? AND (team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=t.team_id AND tm.user_id=?)) LIMIT 20",orgId,term,uid),"documents",db.queryForList("SELECT id,title,'document' type,'/documents' href FROM document.documents d WHERE organization_id=? AND deleted_at IS NULL AND (lower(title) LIKE ? OR lower(content) LIKE ?) AND (team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=d.team_id AND tm.user_id=?)) LIMIT 20",orgId,term,term,uid),"messages",db.queryForList("SELECT m.id,m.content title,'message' type,'/chat' href FROM chat.messages m JOIN chat.channels c ON c.id=m.channel_id WHERE m.organization_id=? AND m.deleted_at IS NULL AND m.status='SENT' AND lower(m.content) LIKE ? AND (c.team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=c.team_id AND tm.user_id=?)) AND (c.type<>'PRIVATE' OR EXISTS (SELECT 1 FROM chat.channel_members cm WHERE cm.channel_id=c.id AND cm.user_id=?)) LIMIT 20",orgId,term,uid,uid),"files",db.queryForList("SELECT id,name title,'file' type,'/files' href FROM nexus_storage.files f WHERE organization_id=? AND deleted_at IS NULL AND lower(name) LIKE ? AND (team_id IS NULL OR EXISTS(SELECT 1 FROM org.team_members tm WHERE tm.team_id=f.team_id AND tm.user_id=?)) LIMIT 20",orgId,term,uid),"projects",db.queryForList("SELECT id,name title,'project' type,'/projects' href FROM project.projects p WHERE organization_id=? AND deleted_at IS NULL AND lower(name) LIKE ? AND (team_id IS NULL OR EXISTS(SELECT 1 FROM org.team_members tm WHERE tm.team_id=p.team_id AND tm.user_id=?)) LIMIT 20",orgId,term,uid),"forms",db.queryForList("SELECT id,title,'form' type,'/forms' href FROM nexus_form.forms f WHERE organization_id=? AND deleted_at IS NULL AND lower(title) LIKE ? AND (status='PUBLISHED' OR created_by=? OR EXISTS(SELECT 1 FROM org.memberships m WHERE m.organization_id=? AND m.user_id=? AND m.role IN ('OWNER','ADMIN'))) LIMIT 20",orgId,term,uid,orgId,uid),"events",db.queryForList("SELECT id,title,'event' type,'/calendar' href FROM calendar.events e WHERE organization_id=? AND deleted_at IS NULL AND lower(title) LIKE ? AND (team_id IS NULL OR EXISTS(SELECT 1 FROM org.team_members tm WHERE tm.team_id=e.team_id AND tm.user_id=?)) LIMIT 20",orgId,term,uid)); }

    @GetMapping("/orgs/{orgId}/billing")
    public Map<String,Object> billing(@PathVariable UUID orgId,org.springframework.security.core.Authentication a) { member(orgId,a); return Map.of("enabled",false,"mode","none","message","Recurring subscriptions are disabled."); }

    @GetMapping("/orgs/{orgId}/analytics/summary")
    public Map<String,Object> analytics(@PathVariable UUID orgId,org.springframework.security.core.Authentication a) {
        member(orgId,a);
        return Map.of(
            "members", count("SELECT count(*) FROM org.memberships WHERE organization_id=?", orgId),
            "messages", count("SELECT count(*) FROM chat.messages WHERE organization_id=? AND deleted_at IS NULL", orgId),
            "tasks", count("SELECT count(*) FROM project.tasks WHERE organization_id=? AND deleted_at IS NULL", orgId),
            "completedTasks", count("SELECT count(*) FROM project.tasks WHERE organization_id=? AND status='DONE' AND deleted_at IS NULL", orgId),
            "documents", count("SELECT count(*) FROM document.documents WHERE organization_id=? AND deleted_at IS NULL", orgId),
            "files", count("SELECT count(*) FROM nexus_storage.files WHERE organization_id=? AND deleted_at IS NULL", orgId),
            "meetings", count("SELECT count(*) FROM meeting.meetings WHERE organization_id=? AND deleted_at IS NULL", orgId),
            "events", count("SELECT count(*) FROM calendar.events WHERE organization_id=? AND deleted_at IS NULL", orgId)
        );
    }

    @PostMapping("/orgs/{orgId}/billing/checkout")
    public Map<String,Object> checkout(@PathVariable UUID orgId,org.springframework.security.core.Authentication a) { admin(orgId,a); return Map.of("provider","RAZORPAY","configured",false,"message","Razorpay subscriptions are disabled. Select a one-time payment model before enabling checkout."); }

    @PostMapping("/billing/razorpay/webhook")
    public void webhook(@RequestHeader(value="X-Razorpay-Signature",required=false) String signature,@RequestBody String rawBody) { if(razorpayWebhookSecret.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Razorpay webhook secret is not configured."); if(signature==null||signature.isBlank()||!signature.equals(hmac(rawBody,razorpayWebhookSecret))) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"Invalid Razorpay webhook signature."); }

    private static String hmac(String body,String secret){try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));StringBuilder out=new StringBuilder();for(byte b:mac.doFinal(body.getBytes(StandardCharsets.UTF_8)))out.append(String.format("%02x",b));return out.toString();}catch(Exception e){throw new IllegalStateException("Webhook verification unavailable.",e);}}
    private void putObject(String key,String mime,byte[] bytes){String endpoint=storageUrl.replaceAll("/$","")+"/storage/v1/object/"+storageBucket+"/"+key;RestClient.create().put().uri(endpoint).header("apikey",storageKey).header("Authorization","Bearer "+storageKey).contentType(MediaType.parseMediaType(mime)).body(bytes).retrieve().toBodilessEntity();}

    private long count(String sql, UUID orgId) { return db.queryForObject(sql, Long.class, orgId); }

    private UUID user(org.springframework.security.core.Authentication a){return UUID.fromString(a.getName());}
    private void member(UUID org,org.springframework.security.core.Authentication a){orgs.requireMember(org,user(a));}
    private void admin(UUID org,org.springframework.security.core.Authentication a){member(org,a);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,user(a));if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private void team(UUID org,UUID team,UUID user){if(team!=null&&db.queryForObject("SELECT count(*) FROM org.teams t JOIN org.team_members tm ON tm.team_id=t.id WHERE t.id=? AND t.organization_id=? AND t.deleted_at IS NULL AND tm.user_id=?",Integer.class,team,org,user)==0)throw new SecurityException("You do not have access to this team.");}
    private void audit(UUID org,UUID actor,String action,String type,UUID id){db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,actor,action,type,id);}
}
