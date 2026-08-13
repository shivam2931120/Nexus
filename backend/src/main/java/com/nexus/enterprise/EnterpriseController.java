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
    record RazorpayWebhook(String event, Map<String,Object> payload) {}

    @GetMapping("/orgs/{orgId}/members")
    public List<Map<String,Object>> members(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT u.id,u.email,u.name,m.role,m.created_at FROM org.memberships m JOIN nexus_auth.users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name",orgId); }

    @PatchMapping("/orgs/{orgId}/members/{userId}/role")
    public Map<String,Object> role(@PathVariable UUID orgId,@PathVariable UUID userId,@Valid @RequestBody RoleChange r,org.springframework.security.core.Authentication a) { admin(orgId,a); if(!Set.of("OWNER","ADMIN","MEMBER").contains(r.role())) throw new IllegalArgumentException("Unsupported role."); db.update("UPDATE org.memberships SET role=? WHERE organization_id=? AND user_id=?",r.role(),orgId,userId); audit(orgId,user(a),"membership.role_changed","membership",userId); return db.queryForMap("SELECT user_id,role FROM org.memberships WHERE organization_id=? AND user_id=?",orgId,userId); }

    @DeleteMapping("/orgs/{orgId}/members/{userId}")
    public void removeMember(@PathVariable UUID orgId,@PathVariable UUID userId,org.springframework.security.core.Authentication a) { admin(orgId,a); if(user(a).equals(userId)) throw new IllegalArgumentException("You cannot remove yourself."); db.update("DELETE FROM org.team_members WHERE user_id=? AND team_id IN (SELECT id FROM org.teams WHERE organization_id=?)",userId,orgId); db.update("DELETE FROM org.memberships WHERE organization_id=? AND user_id=?",orgId,userId); audit(orgId,user(a),"membership.removed","membership",userId); }

    @GetMapping("/orgs/{orgId}/meetings")
    public List<Map<String,Object>> meetings(@PathVariable UUID orgId,org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,title,room_name,scheduled_at,duration_minutes,status,team_id,created_by FROM meeting.meetings WHERE organization_id=? AND deleted_at IS NULL ORDER BY scheduled_at NULLS FIRST",orgId); }

    @PostMapping("/orgs/{orgId}/meetings")
    public Map<String,Object> createMeeting(@PathVariable UUID orgId,@Valid @RequestBody CreateMeeting r,org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); UUID id=UUID.randomUUID(); String room=Objects.requireNonNullElse(r.roomName(),"nexus-"+id.toString().substring(0,12)); db.update("INSERT INTO meeting.meetings(id,organization_id,team_id,title,room_name,scheduled_at,duration_minutes,created_by) VALUES(?,?,?,?,?,?,?,?)",id,orgId,r.teamId(),r.title(),room,r.scheduledAt(),Objects.requireNonNullElse(r.durationMinutes(),30),uid); audit(orgId,uid,"meeting.created","meeting",id); return db.queryForMap("SELECT id,title,room_name,scheduled_at,duration_minutes,status,team_id,created_by FROM meeting.meetings WHERE id=?",id); }

    @PostMapping(value="/orgs/{orgId}/files/upload", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@PathVariable UUID orgId,@RequestPart("file") MultipartFile file,@RequestParam(required=false) UUID teamId,org.springframework.security.core.Authentication a) throws java.io.IOException { UUID uid=user(a); member(orgId,a); if(file.isEmpty()||file.getSize()>524288000L) throw new IllegalArgumentException("File is empty or exceeds the 500 MB limit."); if(storageUrl.isBlank()||storageKey.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Supabase Storage is not configured."); UUID id=UUID.randomUUID(); String safe=file.getOriginalFilename()==null?"upload":file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]","-"); String key=orgId+"/"+id+"/"+safe; String endpoint=storageUrl.replaceAll("/$","")+"/storage/v1/object/"+storageBucket+"/"+key; RestClient.create().put().uri(endpoint).header("apikey",storageKey).header("Authorization","Bearer "+storageKey).contentType(MediaType.parseMediaType(Objects.requireNonNullElse(file.getContentType(),"application/octet-stream"))).body(file.getBytes()).retrieve().toBodilessEntity(); db.update("INSERT INTO nexus_storage.files(id,organization_id,team_id,name,object_key,mime_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?,?)",id,orgId,teamId,safe,key,Objects.requireNonNullElse(file.getContentType(),"application/octet-stream"),file.getSize(),uid); audit(orgId,uid,"file.uploaded","file",id); return db.queryForMap("SELECT id,name,object_key,mime_type,size_bytes,created_at,team_id FROM nexus_storage.files WHERE id=?",id); }

    @PostMapping("/meetings/{id}/join")
    public Map<String,Object> joinMeeting(@PathVariable UUID id,org.springframework.security.core.Authentication a) { Map<String,Object> m=db.queryForMap("SELECT id,organization_id,room_name FROM meeting.meetings WHERE id=? AND deleted_at IS NULL",id); member((UUID)m.get("organization_id"),a); UUID uid=user(a); db.update("INSERT INTO meeting.participants(meeting_id,user_id,joined_at) VALUES(?,?,now()) ON CONFLICT(meeting_id,user_id) DO UPDATE SET joined_at=now(),left_at=NULL",id,uid); audit((UUID)m.get("organization_id"),uid,"meeting.joined","meeting",id); return Map.of("meetingId",id,"roomName",m.get("room_name")); }

    @GetMapping("/search")
    public Map<String,Object> search(@RequestParam String q, @RequestParam UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); String term="%"+q.trim().toLowerCase()+"%"; return Map.of("tasks",db.queryForList("SELECT id,title,'task' type FROM project.tasks WHERE organization_id=? AND deleted_at IS NULL AND lower(title) LIKE ? LIMIT 20",orgId,term),"documents",db.queryForList("SELECT id,title,'document' type FROM document.documents WHERE organization_id=? AND deleted_at IS NULL AND (lower(title) LIKE ? OR lower(content) LIKE ?) LIMIT 20",orgId,term,term),"messages",db.queryForList("SELECT id,content,'message' type FROM chat.messages WHERE organization_id=? AND deleted_at IS NULL AND lower(content) LIKE ? LIMIT 20",orgId,term)); }

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

    private long count(String sql, UUID orgId) { return db.queryForObject(sql, Long.class, orgId); }

    private UUID user(org.springframework.security.core.Authentication a){return UUID.fromString(a.getName());}
    private void member(UUID org,org.springframework.security.core.Authentication a){orgs.requireMember(org,user(a));}
    private void admin(UUID org,org.springframework.security.core.Authentication a){member(org,a);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,user(a));if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private void audit(UUID org,UUID actor,String action,String type,UUID id){db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,actor,action,type,id);}
}
