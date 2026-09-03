package com.nexus.enterprise;

import com.nexus.org.OrganizationController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;

/** APIs for the advanced suite features. Every query is scoped through membership. */
@RestController
@RequestMapping("/api")
public class SuiteExpansionController {
    private final JdbcTemplate db;
    private final OrganizationController organizations;
    private final org.springframework.messaging.simp.SimpMessagingTemplate broker;
    private static final SecureRandom RANDOM = new SecureRandom();

    public SuiteExpansionController(JdbcTemplate db, OrganizationController organizations,
                                    org.springframework.messaging.simp.SimpMessagingTemplate broker) {
        this.db = db; this.organizations = organizations; this.broker = broker;
    }

    record ScheduleMessage(String content, UUID parentId, OffsetDateTime scheduledAt) {}
    record ModerationRequest(String action, String reason) {}
    record FolderRequest(String name, UUID parentId, UUID teamId) {}
    record ShareRequest(OffsetDateTime expiresAt, Integer maxDownloads) {}
    record ResourceRequest(String name, String type, Integer capacity) {}
    record AvailabilityRequest(Integer weekday, String startsAt, String endsAt, String timezone) {}
    record RiskRequest(String title, String description, Integer probability, Integer impact, String status, UUID ownerId, String mitigation) {}
    record RiskUpdate(String title, String description, Integer probability, Integer impact, String status, UUID ownerId, String mitigation) {}
    record TemplateRequest(String name, String description, List<Map<String,Object>> tasks) {}
    record AdvancedFormRequest(Boolean anonymousEnabled, List<Map<String,Object>> approvalRoute) {}
    record AnonymousSubmission(Map<String,Object> responses, String submitterLabel) {}

    @GetMapping("/channels/{channelId}/messages/enriched")
    public List<Map<String,Object>> messages(@PathVariable UUID channelId, Authentication a) {
        channel(channelId, a);
        return db.queryForList("""
          SELECT m.id,m.content,m.sender_id,m.parent_id,m.created_at,m.edited_at,m.status,m.scheduled_at,
                 u.name sender_name,
                 COALESCE((SELECT jsonb_object_agg(emoji,total) FROM (SELECT emoji,count(*) total FROM chat.message_reactions r WHERE r.message_id=m.id GROUP BY emoji) x),'{}') reactions,
                 EXISTS(SELECT 1 FROM chat.pinned_messages p WHERE p.message_id=m.id) pinned,
                 (SELECT count(*) FROM chat.messages t WHERE t.parent_id=m.id AND t.deleted_at IS NULL) thread_count
          FROM chat.messages m JOIN nexus_auth.users u ON u.id=m.sender_id
          WHERE m.channel_id=? AND m.deleted_at IS NULL AND m.status<>'MODERATED'
            AND (m.status='SENT' OR m.sender_id=?) ORDER BY m.created_at
          """, channelId, user(a));
    }

    @PostMapping("/channels/{channelId}/messages/schedule")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> schedule(@PathVariable UUID channelId, @RequestBody ScheduleMessage r, Authentication a) {
        UUID org = channel(channelId,a), uid=user(a), id=UUID.randomUUID();
        if (r.content()==null || r.content().isBlank() || r.scheduledAt()==null || !r.scheduledAt().isAfter(OffsetDateTime.now())) throw new IllegalArgumentException("Choose a future time and enter a message.");
        db.update("INSERT INTO chat.messages(id,channel_id,organization_id,sender_id,content,parent_id,status,scheduled_at) VALUES(?,?,?,?,?,?,'SCHEDULED',?)",id,channelId,org,uid,r.content().trim(),r.parentId(),r.scheduledAt());
        mentions(id,org,r.content()); audit(org,uid,"message.scheduled","message",id);
        return db.queryForMap("SELECT id,content,parent_id,status,scheduled_at,created_at FROM chat.messages WHERE id=?",id);
    }

    @PutMapping("/channels/{channelId}/read")
    public void read(@PathVariable UUID channelId, Authentication a) {
        channel(channelId,a); db.update("INSERT INTO chat.channel_members(channel_id,user_id,last_read_at) VALUES(?,?,now()) ON CONFLICT(channel_id,user_id) DO UPDATE SET last_read_at=now()",channelId,user(a));
    }

    @GetMapping("/channels/{channelId}/read-receipts")
    public List<Map<String,Object>> receipts(@PathVariable UUID channelId, Authentication a) {
        channel(channelId,a); return db.queryForList("SELECT cm.user_id,u.name,cm.last_read_at FROM chat.channel_members cm JOIN nexus_auth.users u ON u.id=cm.user_id WHERE cm.channel_id=? ORDER BY cm.last_read_at DESC NULLS LAST",channelId);
    }

    @PostMapping("/messages/{id}/moderate")
    public void moderate(@PathVariable UUID id,@RequestBody ModerationRequest r,Authentication a) {
        Map<String,Object> m=db.queryForMap("SELECT m.organization_id,m.channel_id FROM chat.messages m WHERE m.id=?",id); UUID org=(UUID)m.get("organization_id"); admin(org,a);
        String action=Objects.toString(r.action(),"HIDE").toUpperCase(Locale.ROOT); if(!Set.of("HIDE","RESTORE").contains(action)) throw new IllegalArgumentException("Unsupported moderation action.");
        db.update(action.equals("HIDE")?"UPDATE chat.messages SET status='MODERATED',moderated_at=now(),moderated_by=?,moderation_reason=? WHERE id=?":"UPDATE chat.messages SET status='SENT',moderated_at=NULL,moderated_by=NULL,moderation_reason=NULL WHERE id=?", action.equals("HIDE")?new Object[]{user(a),r.reason(),id}:new Object[]{id});
        db.update("INSERT INTO chat.moderation_actions(id,organization_id,channel_id,message_id,actor_id,action,reason) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID(),org,m.get("channel_id"),id,user(a),action,r.reason());
    }

    @GetMapping("/orgs/{orgId}/folders") public List<Map<String,Object>> folders(@PathVariable UUID orgId,@RequestParam(required=false) UUID parentId,Authentication a){member(orgId,a);return db.queryForList("SELECT id,name,parent_id,team_id,created_at FROM nexus_storage.folders f WHERE organization_id=? AND deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM ? AND (team_id IS NULL OR EXISTS(SELECT 1 FROM org.team_members tm WHERE tm.team_id=f.team_id AND tm.user_id=?)) ORDER BY name",orgId,parentId,user(a));}
    @PostMapping("/orgs/{orgId}/folders") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> folder(@PathVariable UUID orgId,@RequestBody FolderRequest r,Authentication a){member(orgId,a);if(r.name()==null||r.name().isBlank())throw new IllegalArgumentException("Folder name is required.");UUID id=UUID.randomUUID();db.update("INSERT INTO nexus_storage.folders(id,organization_id,team_id,parent_id,name,created_by) VALUES(?,?,?,?,?,?)",id,orgId,r.teamId(),r.parentId(),r.name().trim(),user(a));return db.queryForMap("SELECT id,name,parent_id,team_id,created_at FROM nexus_storage.folders WHERE id=?",id);}
    @GetMapping("/files/{id}/versions") public List<Map<String,Object>> versions(@PathVariable UUID id,Authentication a){Map<String,Object> f=file(id,a);return db.queryForList("SELECT id,version_number,size_bytes,mime_type,created_by,created_at FROM nexus_storage.file_versions WHERE file_id=? ORDER BY version_number DESC",f.get("id"));}
    @GetMapping("/files/{id}/shared-links") public List<Map<String,Object>> sharedLinks(@PathVariable UUID id,Authentication a){Map<String,Object> f=file(id,a);return db.queryForList("SELECT id,token,expires_at,max_downloads,download_count,created_at,revoked_at FROM nexus_storage.shared_links WHERE file_id=? ORDER BY created_at DESC",f.get("id"));}
    @PostMapping("/files/{id}/share") public Map<String,Object> share(@PathVariable UUID id,@RequestBody ShareRequest r,Authentication a){Map<String,Object> f=file(id,a);String token=token();UUID link=UUID.randomUUID();db.update("INSERT INTO nexus_storage.shared_links(id,file_id,token,created_by,expires_at,max_downloads) VALUES(?,?,?,?,?,?)",link,id,token,user(a),r.expiresAt(),r.maxDownloads());audit((UUID)f.get("organization_id"),user(a),"file.shared","file",id);return Map.of("id",link,"token",token,"path","/shared/files/"+token);}
    @DeleteMapping("/shared-links/{id}") public void revoke(@PathVariable UUID id,Authentication a){Map<String,Object> l=db.queryForMap("SELECT l.id,f.organization_id FROM nexus_storage.shared_links l JOIN nexus_storage.files f ON f.id=l.file_id WHERE l.id=?",id);member((UUID)l.get("organization_id"),a);db.update("UPDATE nexus_storage.shared_links SET revoked_at=now() WHERE id=?",id);}

    @GetMapping("/orgs/{orgId}/calendar/resources") public List<Map<String,Object>> resources(@PathVariable UUID orgId,Authentication a){member(orgId,a);return db.queryForList("SELECT id,name,type,capacity,active FROM calendar.resources WHERE organization_id=? ORDER BY name",orgId);}
    @PostMapping("/orgs/{orgId}/calendar/resources") public Map<String,Object> resource(@PathVariable UUID orgId,@RequestBody ResourceRequest r,Authentication a){admin(orgId,a);UUID id=UUID.randomUUID();db.update("INSERT INTO calendar.resources(id,organization_id,name,type,capacity) VALUES(?,?,?,?,?)",id,orgId,r.name(),Objects.toString(r.type(),"ROOM"),r.capacity());return db.queryForMap("SELECT id,name,type,capacity,active FROM calendar.resources WHERE id=?",id);}
    @PutMapping("/orgs/{orgId}/calendar/availability") public void availability(@PathVariable UUID orgId,@RequestBody AvailabilityRequest r,Authentication a){member(orgId,a);if(r.weekday()==null||r.weekday()<0||r.weekday()>6)throw new IllegalArgumentException("Weekday must be between 0 and 6.");db.update("INSERT INTO calendar.availability(id,organization_id,user_id,weekday,starts_at,ends_at,timezone) VALUES(?,?,?, ?,?::time,?::time,?) ON CONFLICT(organization_id,user_id,weekday,starts_at) DO UPDATE SET ends_at=EXCLUDED.ends_at,timezone=EXCLUDED.timezone",UUID.randomUUID(),orgId,user(a),r.weekday(),r.startsAt(),r.endsAt(),Objects.toString(r.timezone(),"UTC"));}
    @GetMapping("/orgs/{orgId}/calendar/availability") public List<Map<String,Object>> availability(@PathVariable UUID orgId,Authentication a){member(orgId,a);return db.queryForList("SELECT a.user_id,u.name,a.weekday,a.starts_at,a.ends_at,a.timezone FROM calendar.availability a JOIN nexus_auth.users u ON u.id=a.user_id WHERE a.organization_id=? ORDER BY u.name,a.weekday,a.starts_at",orgId);}

    @GetMapping("/projects/{projectId}/risks") public List<Map<String,Object>> risks(@PathVariable UUID projectId,Authentication a){Map<String,Object> p=project(projectId,a);return db.queryForList("SELECT *,probability*impact score FROM project.risks WHERE project_id=? ORDER BY probability*impact DESC,created_at DESC",p.get("id"));}
    @PostMapping("/projects/{projectId}/risks") public Map<String,Object> risk(@PathVariable UUID projectId,@RequestBody RiskRequest r,Authentication a){project(projectId,a);UUID id=UUID.randomUUID();db.update("INSERT INTO project.risks(id,project_id,title,description,probability,impact,status,owner_id,mitigation) VALUES(?,?,?,?,?,?,?,?,?)",id,projectId,r.title(),r.description(),Objects.requireNonNullElse(r.probability(),1),Objects.requireNonNullElse(r.impact(),1),Objects.toString(r.status(),"OPEN"),r.ownerId(),r.mitigation());return db.queryForMap("SELECT *,probability*impact score FROM project.risks WHERE id=?",id);}
    @PatchMapping("/risks/{id}") public Map<String,Object> updateRisk(@PathVariable UUID id,@RequestBody RiskUpdate r,Authentication a){Map<String,Object> row=db.queryForMap("SELECT r.project_id,p.organization_id FROM project.risks r JOIN project.projects p ON p.id=r.project_id WHERE r.id=? AND p.deleted_at IS NULL",id);member((UUID)row.get("organization_id"),a);db.update("UPDATE project.risks SET title=COALESCE(?,title),description=?,probability=COALESCE(?,probability),impact=COALESCE(?,impact),status=COALESCE(?,status),owner_id=?,mitigation=?,updated_at=now() WHERE id=?",r.title()==null?null:r.title().trim(),r.description(),r.probability(),r.impact(),r.status(),r.ownerId(),r.mitigation(),id);return db.queryForMap("SELECT *,probability*impact score FROM project.risks WHERE id=?",id);}
    @DeleteMapping("/risks/{id}") public void deleteRisk(@PathVariable UUID id,Authentication a){Map<String,Object> row=db.queryForMap("SELECT r.project_id,p.organization_id FROM project.risks r JOIN project.projects p ON p.id=r.project_id WHERE r.id=? AND p.deleted_at IS NULL",id);member((UUID)row.get("organization_id"),a);db.update("DELETE FROM project.risks WHERE id=?",id);}
    @GetMapping("/orgs/{orgId}/project-templates") public List<Map<String,Object>> templates(@PathVariable UUID orgId,Authentication a){member(orgId,a);return db.queryForList("SELECT id,name,description,tasks,created_at FROM project.templates WHERE organization_id=? ORDER BY created_at DESC",orgId);}
    @PostMapping("/orgs/{orgId}/project-templates") public Map<String,Object> template(@PathVariable UUID orgId,@RequestBody TemplateRequest r,Authentication a){member(orgId,a);UUID id=UUID.randomUUID();db.update("INSERT INTO project.templates(id,organization_id,name,description,tasks,created_by) VALUES(?,?,?,?,?::jsonb,?)",id,orgId,r.name(),r.description(),json(r.tasks()),user(a));return db.queryForMap("SELECT id,name,description,tasks,created_at FROM project.templates WHERE id=?",id);}
    @PostMapping("/projects/{projectId}/apply-template/{templateId}") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> applyTemplate(@PathVariable UUID projectId,@PathVariable UUID templateId,@RequestBody(required=false) Map<String,Object> body,Authentication a){Map<String,Object> p=db.queryForMap("SELECT id,organization_id,team_id FROM project.projects WHERE id=? AND deleted_at IS NULL",projectId);UUID org=(UUID)p.get("organization_id");member(org,a);Map<String,Object> t=db.queryForMap("SELECT id,tasks FROM project.templates WHERE id=? AND organization_id=?",templateId,org);UUID team=(UUID)p.get("team_id");if(team==null&&body!=null&&body.get("teamId")!=null)team=UUID.fromString(Objects.toString(body.get("teamId")));if(team==null)throw new IllegalArgumentException("Assign a team to the project before applying a task template.");team(org,team,user(a));try{List<?> tasks=new com.fasterxml.jackson.databind.ObjectMapper().readValue(Objects.toString(t.get("tasks"),"[]"),List.class);int created=0;for(Object entry:tasks){if(!(entry instanceof Map<?,?> item)||Objects.toString(item.get("title"),"").isBlank())continue;db.update("INSERT INTO project.tasks(id,organization_id,project_id,team_id,title,description,priority) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID(),org,projectId,team,Objects.toString(item.get("title")).trim(),Objects.toString(item.get("description"),""),Objects.toString(item.get("priority"),"MEDIUM"));created++;}return Map.of("projectId",projectId,"templateId",templateId,"created",created);}catch(Exception e){throw new IllegalArgumentException("The project template could not be applied.",e);}}

    @PutMapping("/forms/{id}/advanced") public Map<String,Object> advancedForm(@PathVariable UUID id,@RequestBody AdvancedFormRequest r,Authentication a){Map<String,Object> f=db.queryForMap("SELECT id,organization_id FROM nexus_form.forms WHERE id=? AND deleted_at IS NULL",id);admin((UUID)f.get("organization_id"),a);String slug=Boolean.TRUE.equals(r.anonymousEnabled())?"form-"+token().substring(0,16):null;db.update("UPDATE nexus_form.forms SET anonymous_enabled=?,approval_route=?::jsonb,public_slug=?,updated_at=now() WHERE id=?",Boolean.TRUE.equals(r.anonymousEnabled()),json(r.approvalRoute()),slug,id);return db.queryForMap("SELECT id,anonymous_enabled,approval_route,public_slug FROM nexus_form.forms WHERE id=?",id);}
    @GetMapping("/public/forms/{slug}") public Map<String,Object> publicForm(@PathVariable String slug){return db.queryForMap("SELECT id,title,description,category,fields,anonymous_enabled FROM nexus_form.forms WHERE public_slug=? AND anonymous_enabled AND status='PUBLISHED' AND deleted_at IS NULL",slug);}
    @PostMapping("/public/forms/{slug}/submissions") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> anonymousSubmit(@PathVariable String slug,@RequestBody AnonymousSubmission r){Map<String,Object> f=db.queryForMap("SELECT id,organization_id,title,fields::text fields_json,approval_required,approval_route FROM nexus_form.forms WHERE public_slug=? AND anonymous_enabled AND status='PUBLISHED' AND deleted_at IS NULL",slug);Map<String,Object> responses=r.responses()==null?new LinkedHashMap<>():new LinkedHashMap<>(r.responses());List<Map<String,Object>> fields=readList(Objects.toString(f.get("fields_json"),"[]"));applyCalculations(fields,responses);validateResponses(fields,responses);UUID id=UUID.randomUUID();String status=Boolean.TRUE.equals(f.get("approval_required"))?"PENDING":"SUBMITTED";db.update("INSERT INTO nexus_form.submissions(id,form_id,organization_id,submitted_by,submitter_label,responses,status) VALUES(?,?,?,NULL,?,?::jsonb,?)",id,f.get("id"),f.get("organization_id"),Objects.toString(r.submitterLabel(),"Anonymous"),json(responses),status);if("PENDING".equals(status))notifyApprovers((UUID)f.get("organization_id"),Objects.toString(f.get("title"),"Form response"),f.get("approval_route"));return Map.of("id",id,"status",status);}
    @GetMapping("/forms/{id}/analytics") public Map<String,Object> formAnalytics(@PathVariable UUID id,Authentication a){Map<String,Object> f=db.queryForMap("SELECT id,organization_id,fields FROM nexus_form.forms WHERE id=? AND deleted_at IS NULL",id);admin((UUID)f.get("organization_id"),a);return Map.of("total",db.queryForObject("SELECT count(*) FROM nexus_form.submissions WHERE form_id=?",Long.class,id),"byStatus",db.queryForList("SELECT status,count(*) total FROM nexus_form.submissions WHERE form_id=? GROUP BY status ORDER BY status",id),"daily",db.queryForList("SELECT submitted_at::date day,count(*) total FROM nexus_form.submissions WHERE form_id=? GROUP BY submitted_at::date ORDER BY day",id));}
    @GetMapping(value="/forms/{id}/export",produces="text/csv") public ResponseEntity<String> exportForm(@PathVariable UUID id,Authentication a){Map<String,Object> f=db.queryForMap("SELECT id,organization_id FROM nexus_form.forms WHERE id=? AND deleted_at IS NULL",id);admin((UUID)f.get("organization_id"),a);StringBuilder csv=new StringBuilder("submission_id,status,submitted_at,submitter,responses\n");for(Map<String,Object> row:db.queryForList("SELECT s.id,s.status,s.submitted_at,COALESCE(u.email,s.submitter_label,'Anonymous') submitter,s.responses::text responses FROM nexus_form.submissions s LEFT JOIN nexus_auth.users u ON u.id=s.submitted_by WHERE s.form_id=? ORDER BY s.submitted_at",id)){csv.append(cell(row.get("id"))).append(',').append(cell(row.get("status"))).append(',').append(cell(row.get("submitted_at"))).append(',').append(cell(row.get("submitter"))).append(',').append(cell(row.get("responses"))).append('\n');}return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv")).header("Content-Disposition","attachment; filename=form-responses.csv").body(csv.toString());}

    @Scheduled(fixedDelay = 15000)
    public void publishScheduledMessages(){List<Map<String,Object>> due=db.queryForList("UPDATE chat.messages SET status='SENT',sent_at=now() WHERE status='SCHEDULED' AND scheduled_at<=now() RETURNING id,channel_id,content,sender_id,parent_id,created_at");for(Map<String,Object> m:due)broker.convertAndSend("/topic/channel."+m.get("channel_id"),m);}

    private void mentions(UUID message,UUID org,String content){for(Map<String,Object> u:db.queryForList("SELECT id,name FROM nexus_auth.users u JOIN org.memberships m ON m.user_id=u.id WHERE m.organization_id=?",org)){String name=Objects.toString(u.get("name"),"");if(!name.isBlank()&&content.toLowerCase().contains("@"+name.toLowerCase())){db.update("INSERT INTO chat.message_mentions(message_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING",message,u.get("id"));db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,u.get("id"),"MENTION","You were mentioned",content);}}}
    private Map<String,Object> file(UUID id,Authentication a){Map<String,Object> f=db.queryForMap("SELECT id,organization_id FROM nexus_storage.files WHERE id=? AND deleted_at IS NULL",id);member((UUID)f.get("organization_id"),a);return f;}
    private Map<String,Object> project(UUID id,Authentication a){Map<String,Object> p=db.queryForMap("SELECT id,organization_id FROM project.projects WHERE id=? AND deleted_at IS NULL",id);member((UUID)p.get("organization_id"),a);return p;}
    private UUID channel(UUID id,Authentication a){UUID org=db.queryForObject("SELECT organization_id FROM chat.channels WHERE id=? AND deleted_at IS NULL",UUID.class,id);member(org,a);return org;}
    private UUID user(Authentication a){return UUID.fromString(a.getName());}
    private void member(UUID org,Authentication a){organizations.requireMember(org,user(a));}
    private void admin(UUID org,Authentication a){member(org,a);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,user(a));if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private void team(UUID org,UUID team,UUID uid){if(team!=null&&db.queryForObject("SELECT count(*) FROM org.teams t JOIN org.team_members tm ON tm.team_id=t.id WHERE t.id=? AND t.organization_id=? AND t.deleted_at IS NULL AND tm.user_id=?",Integer.class,team,org,uid)==0)throw new SecurityException("You do not have access to this team.");}
    private void audit(UUID org,UUID actor,String action,String type,UUID id){db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,actor,action,type,id);}
    private static String token(){byte[] b=new byte[24];RANDOM.nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
    private static String json(Object value){try{return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value==null?List.of():value);}catch(Exception e){throw new IllegalArgumentException("Invalid template tasks.");}}
    private static String cell(Object value){String s=Objects.toString(value,"").replace("\"","\"\"");return "\""+s+"\"";}
    private List<Map<String,Object>> readList(String value){try{return new com.fasterxml.jackson.databind.ObjectMapper().readValue(value,new com.fasterxml.jackson.core.type.TypeReference<>(){});}catch(Exception e){throw new IllegalArgumentException("Form fields are invalid.");}}
    private void validateResponses(List<Map<String,Object>> fields,Map<String,Object> responses){Set<String> allowed=new HashSet<>();for(Map<String,Object> field:fields){String id=String.valueOf(field.get("id"));allowed.add(id);String condition=Objects.toString(field.get("conditionField"),"");if(!condition.isBlank()&&!Objects.equals(Objects.toString(responses.get(condition),""),Objects.toString(field.get("conditionEquals"),"")))continue;Object value=responses.get(id);if(Boolean.TRUE.equals(field.get("required"))&&(value==null||String.valueOf(value).isBlank()))throw new IllegalArgumentException(field.get("label")+" is required.");}if(!allowed.containsAll(responses.keySet()))throw new IllegalArgumentException("The response contains fields that do not belong to this form.");}
    private void applyCalculations(List<Map<String,Object>> fields,Map<String,Object> responses){for(Map<String,Object> field:fields){if(!"CALCULATED".equals(field.get("type")))continue;String formula=Objects.toString(field.get("formula"),"").replaceAll("[^A-Za-z0-9_+\\-*/(). ]","");double total=0;boolean first=true;for(String part:formula.split("\\+")){double value;try{value=Double.parseDouble(part.trim());}catch(Exception ignored){Object raw=responses.get(part.trim());try{value=Double.parseDouble(Objects.toString(raw,"0"));}catch(Exception e){value=0;}}total=first?value:total+value;first=false;}responses.put(String.valueOf(field.get("id")),total);}}
    private void notifyApprovers(UUID orgId,String title,Object routeValue){Set<UUID> reviewers=new LinkedHashSet<>();List<Map<String,Object>> route=readList(routeValue==null?"[]":String.valueOf(routeValue));for(Map<String,Object> step:route){Object rawUser=step.get("userId");if(rawUser!=null)try{UUID candidate=UUID.fromString(String.valueOf(rawUser));if(db.queryForObject("SELECT count(*) FROM org.memberships WHERE organization_id=? AND user_id=?",Integer.class,orgId,candidate)>0)reviewers.add(candidate);}catch(IllegalArgumentException ignored){}String role=Objects.toString(step.get("role"),"").trim().toUpperCase(Locale.ROOT);if(!role.isBlank())reviewers.addAll(db.query("SELECT user_id FROM org.memberships WHERE organization_id=? AND role=?",(rs,row)->rs.getObject("user_id",UUID.class),orgId,role));}if(reviewers.isEmpty())reviewers.addAll(db.query("SELECT user_id FROM org.memberships WHERE organization_id=? AND role IN ('OWNER','ADMIN')",(rs,row)->rs.getObject("user_id",UUID.class),orgId));for(UUID reviewer:reviewers)db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),orgId,reviewer,"FORM_APPROVAL","Form approval requested","A new response to "+title+" needs review.");}
}
