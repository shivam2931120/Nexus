package com.nexus.enterprise;

import com.nexus.org.OrganizationController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
public class CompletionController {
    private final JdbcTemplate db;
    private final OrganizationController organizations;
    private final String nemotronKey;
    private final String nemotronUrl;
    private final String nemotronModel;

    public CompletionController(JdbcTemplate db, OrganizationController organizations,
                                @Value("${nexus.nemotron.api-key:}") String nemotronKey,
                                @Value("${nexus.nemotron.api-url:https://integrate.api.nvidia.com/v1/chat/completions}") String nemotronUrl,
                                @Value("${nexus.nemotron.model:nvidia/llama-3.1-nemotron-ultra-253b-v1}") String nemotronModel) {
        this.db = db; this.organizations = organizations; this.nemotronKey = nemotronKey;
        this.nemotronUrl = nemotronUrl; this.nemotronModel = nemotronModel;
    }

    record CommentRequest(@NotBlank String content, Integer selectionStart, Integer selectionEnd) {}
    record ChecklistRequest(@NotBlank String content) {}
    record ChecklistUpdate(Boolean completed) {}
    record ReactionRequest(@NotBlank String emoji) {}
    record TimeLogRequest(@Positive Integer minutes, String description) {}
    record ProfileRequest(String title, String department, String bio, List<String> skills, String location, String availability, UUID managerId, String avatarUrl) {}
    record BoardRequest(@NotBlank String name, Map<String,Object> data, UUID teamId) {}
    record BoardUpdate(Map<String,Object> data, @NotBlank String name) {}
    record AiRequest(@NotBlank String message, String context) {}
    record TeamMemberRequest(UUID userId) {}

    @GetMapping("/orgs/{orgId}/dashboard")
    public Map<String,Object> dashboard(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) {
        member(orgId, a);
        UUID uid = user(a);
        return Map.of(
            "user", db.queryForMap("SELECT id,name,email FROM nexus_auth.users WHERE id=?", uid),
            "meetings", db.queryForList("SELECT id,title,scheduled_at,duration_minutes,room_name FROM meeting.meetings WHERE organization_id=? AND deleted_at IS NULL AND (scheduled_at IS NULL OR scheduled_at>=now()) ORDER BY scheduled_at NULLS FIRST LIMIT 5", orgId),
            "tasks", db.queryForList("SELECT id,title,status,priority,due_date,project_id FROM project.tasks WHERE organization_id=? AND assignee_id=? AND deleted_at IS NULL ORDER BY due_date NULLS LAST LIMIT 8", orgId, uid),
            "notifications", db.queryForList("SELECT id,title,body,read_at,created_at FROM notification.notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 8", uid),
            "documents", db.queryForList("SELECT id,title,updated_at,version FROM document.documents WHERE organization_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5", orgId),
            "messages", db.queryForList("SELECT m.id,m.content,m.created_at,c.name channel_name,u.name sender_name FROM chat.messages m JOIN chat.channels c ON c.id=m.channel_id JOIN nexus_auth.users u ON u.id=m.sender_id WHERE m.organization_id=? AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 8", orgId),
            "activity", db.queryForList("SELECT e.action,e.entity_type,e.created_at,u.name actor_name FROM audit.events e JOIN nexus_auth.users u ON u.id=e.actor_id WHERE e.organization_id=? ORDER BY e.created_at DESC LIMIT 8", orgId)
        );
    }

    @GetMapping("/orgs/{orgId}/analytics/trends")
    public Map<String,Object> trends(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) {
        member(orgId, a);
        return Map.of(
            "tasksByStatus", db.queryForList("SELECT status,count(*) value FROM project.tasks WHERE organization_id=? AND deleted_at IS NULL GROUP BY status ORDER BY status", orgId),
            "messagesByDay", db.queryForList("SELECT date_trunc('day',created_at) day,count(*) value FROM chat.messages WHERE organization_id=? AND deleted_at IS NULL AND created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1", orgId),
            "eventsByDay", db.queryForList("SELECT date_trunc('day',starts_at) day,count(*) value FROM calendar.events WHERE organization_id=? AND deleted_at IS NULL AND starts_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1", orgId),
            "storageByType", db.queryForList("SELECT mime_type type,sum(size_bytes) bytes,count(*) files FROM nexus_storage.files WHERE organization_id=? AND deleted_at IS NULL GROUP BY mime_type ORDER BY bytes DESC", orgId)
        );
    }

    @PatchMapping("/notifications/read-all")
    public void readAll(org.springframework.security.core.Authentication a) { db.update("UPDATE notification.notifications SET read_at=now() WHERE user_id=? AND read_at IS NULL", user(a)); }

    @GetMapping("/teams/{teamId}/members")
    public List<Map<String,Object>> teamMembers(@PathVariable UUID teamId, org.springframework.security.core.Authentication a) { UUID org = teamOrg(teamId); member(org, a); return db.queryForList("SELECT u.id,u.name,u.email,m.role FROM org.team_members tm JOIN nexus_auth.users u ON u.id=tm.user_id JOIN org.memberships m ON m.organization_id=? AND m.user_id=tm.user_id WHERE tm.team_id=? ORDER BY u.name", org, teamId); }
    @PostMapping("/teams/{teamId}/members")
    public void addTeamMember(@PathVariable UUID teamId, @RequestBody TeamMemberRequest r, org.springframework.security.core.Authentication a) { UUID org = teamOrg(teamId); admin(org, a); db.update("INSERT INTO org.team_members(team_id,user_id) SELECT ?,? WHERE EXISTS (SELECT 1 FROM org.memberships WHERE organization_id=? AND user_id=?) ON CONFLICT DO NOTHING", teamId, r.userId(), org, r.userId()); }
    @DeleteMapping("/teams/{teamId}/members/{userId}")
    public void removeTeamMember(@PathVariable UUID teamId, @PathVariable UUID userId, org.springframework.security.core.Authentication a) { UUID org = teamOrg(teamId); admin(org, a); db.update("DELETE FROM org.team_members WHERE team_id=? AND user_id=?", teamId, userId); }

    @GetMapping("/orgs/{orgId}/directory")
    public List<Map<String,Object>> directory(@PathVariable UUID orgId, @RequestParam(required=false) String q, org.springframework.security.core.Authentication a) {
        member(orgId, a); String term = "%" + Objects.toString(q, "").trim().toLowerCase() + "%";
        return db.queryForList("SELECT u.id,u.name,u.email,m.role,p.title,p.department,p.bio,p.skills,p.location,p.availability,p.manager_id,p.avatar_url FROM org.memberships m JOIN nexus_auth.users u ON u.id=m.user_id LEFT JOIN org.employee_profiles p ON p.user_id=u.id AND p.organization_id=m.organization_id WHERE m.organization_id=? AND (lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR lower(coalesce(p.department,'')) LIKE ? OR lower(coalesce(p.title,'')) LIKE ?) ORDER BY u.name", orgId, term, term, term, term);
    }

    @PutMapping("/orgs/{orgId}/directory/{userId}")
    public Map<String,Object> profile(@PathVariable UUID orgId, @PathVariable UUID userId, @RequestBody ProfileRequest r, org.springframework.security.core.Authentication a) {
        member(orgId, a); if (!user(a).equals(userId)) admin(orgId, a);
        db.update("INSERT INTO org.employee_profiles(user_id,organization_id,title,department,bio,skills,location,availability,manager_id,avatar_url) VALUES(?,?,?,?,?,?::jsonb,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,bio=EXCLUDED.bio,skills=EXCLUDED.skills,location=EXCLUDED.location,availability=EXCLUDED.availability,manager_id=EXCLUDED.manager_id,avatar_url=EXCLUDED.avatar_url,updated_at=now()", userId, orgId, r.title(), r.department(), r.bio(), toJson(r.skills()), r.location(), Objects.requireNonNullElse(r.availability(), "AVAILABLE"), r.managerId(), r.avatarUrl());
        return db.queryForMap("SELECT u.id,u.name,u.email,m.role,p.title,p.department,p.bio,p.skills,p.location,p.availability,p.manager_id,p.avatar_url FROM org.memberships m JOIN nexus_auth.users u ON u.id=m.user_id LEFT JOIN org.employee_profiles p ON p.user_id=u.id AND p.organization_id=m.organization_id WHERE m.organization_id=? AND u.id=?", orgId, userId);
    }

    @PostMapping("/channels/{channelId}/messages/{messageId}/reactions")
    public void react(@PathVariable UUID channelId, @PathVariable UUID messageId, @Valid @RequestBody ReactionRequest r, org.springframework.security.core.Authentication a) { UUID org = channelOrg(channelId); member(org, a); db.update("INSERT INTO chat.message_reactions(message_id,user_id,emoji) VALUES(?,?,?) ON CONFLICT DO NOTHING", messageId, user(a), r.emoji()); }
    @DeleteMapping("/channels/{channelId}/messages/{messageId}/reactions/{emoji}")
    public void unreact(@PathVariable UUID channelId, @PathVariable UUID messageId, @PathVariable String emoji, org.springframework.security.core.Authentication a) { member(channelOrg(channelId), a); db.update("DELETE FROM chat.message_reactions WHERE message_id=? AND user_id=? AND emoji=?", messageId, user(a), emoji); }
    @PostMapping("/channels/{channelId}/messages/{messageId}/pin")
    public void pin(@PathVariable UUID channelId, @PathVariable UUID messageId, org.springframework.security.core.Authentication a) { member(channelOrg(channelId), a); db.update("INSERT INTO chat.pinned_messages(channel_id,message_id,pinned_by) VALUES(?,?,?) ON CONFLICT DO NOTHING", channelId, messageId, user(a)); }
    @DeleteMapping("/channels/{channelId}/messages/{messageId}/pin")
    public void unpin(@PathVariable UUID channelId, @PathVariable UUID messageId, org.springframework.security.core.Authentication a) { member(channelOrg(channelId), a); db.update("DELETE FROM chat.pinned_messages WHERE channel_id=? AND message_id=?", channelId, messageId); }
    @PatchMapping("/messages/{messageId}")
    public Map<String,Object> editMessage(@PathVariable UUID messageId, @Valid @RequestBody CommentRequest r, org.springframework.security.core.Authentication a) { Map<String,Object> row=db.queryForMap("SELECT organization_id,sender_id FROM chat.messages WHERE id=? AND deleted_at IS NULL",messageId); member((UUID)row.get("organization_id"),a); if(!user(a).equals(row.get("sender_id"))) throw new SecurityException("Only the sender can edit this message."); db.update("UPDATE chat.messages SET content=?,edited_at=now() WHERE id=?",r.content().trim(),messageId); return db.queryForMap("SELECT id,content,sender_id,created_at,edited_at FROM chat.messages WHERE id=?",messageId); }
    @DeleteMapping("/messages/{messageId}")
    public void deleteMessage(@PathVariable UUID messageId, org.springframework.security.core.Authentication a) { Map<String,Object> row=db.queryForMap("SELECT organization_id,sender_id FROM chat.messages WHERE id=? AND deleted_at IS NULL",messageId); member((UUID)row.get("organization_id"),a); if(!user(a).equals(row.get("sender_id"))) throw new SecurityException("Only the sender can delete this message."); db.update("UPDATE chat.messages SET deleted_at=now() WHERE id=?",messageId); }

    @GetMapping("/tasks/{taskId}/comments") public List<Map<String,Object>> taskComments(@PathVariable UUID taskId, org.springframework.security.core.Authentication a) { UUID org=taskOrg(taskId); member(org,a); return db.queryForList("SELECT c.id,c.content,c.created_at,u.name user_name FROM project.task_comments c JOIN nexus_auth.users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at",taskId); }
    @PostMapping("/tasks/{taskId}/comments") public Map<String,Object> taskComment(@PathVariable UUID taskId,@Valid @RequestBody CommentRequest r,org.springframework.security.core.Authentication a){UUID org=taskOrg(taskId);member(org,a);UUID id=UUID.randomUUID();db.update("INSERT INTO project.task_comments(id,task_id,user_id,content) VALUES(?,?,?,?)",id,taskId,user(a),r.content().trim());return db.queryForMap("SELECT c.id,c.content,c.created_at,u.name user_name FROM project.task_comments c JOIN nexus_auth.users u ON u.id=c.user_id WHERE c.id=?",id);}
    @GetMapping("/tasks/{taskId}/checklist") public List<Map<String,Object>> checklist(@PathVariable UUID taskId,org.springframework.security.core.Authentication a){member(taskOrg(taskId),a);return db.queryForList("SELECT id,content,completed,position FROM project.task_checklist_items WHERE task_id=? ORDER BY position,created_at",taskId);}
    @PostMapping("/tasks/{taskId}/checklist") public Map<String,Object> checklistAdd(@PathVariable UUID taskId,@Valid @RequestBody ChecklistRequest r,org.springframework.security.core.Authentication a){member(taskOrg(taskId),a);UUID id=UUID.randomUUID();db.update("INSERT INTO project.task_checklist_items(id,task_id,content,position) VALUES(?,?,?,(SELECT coalesce(max(position),-1)+1 FROM project.task_checklist_items WHERE task_id=?))",id,taskId,r.content().trim(),taskId);return db.queryForMap("SELECT id,content,completed,position FROM project.task_checklist_items WHERE id=?",id);}
    @PatchMapping("/tasks/checklist/{itemId}") public void checklistUpdate(@PathVariable UUID itemId,@RequestBody ChecklistUpdate r,org.springframework.security.core.Authentication a){Map<String,Object> row=db.queryForMap("SELECT task_id FROM project.task_checklist_items WHERE id=?",itemId);member(taskOrg((UUID)row.get("task_id")),a);db.update("UPDATE project.task_checklist_items SET completed=? WHERE id=?",Boolean.TRUE.equals(r.completed()),itemId);}
    @PostMapping("/tasks/{taskId}/time") public Map<String,Object> time(@PathVariable UUID taskId,@Valid @RequestBody TimeLogRequest r,org.springframework.security.core.Authentication a){member(taskOrg(taskId),a);UUID id=UUID.randomUUID();db.update("INSERT INTO project.task_time_logs(id,task_id,user_id,minutes,description) VALUES(?,?,?,?,?)",id,taskId,user(a),r.minutes(),r.description());return db.queryForMap("SELECT id,minutes,description,logged_at FROM project.task_time_logs WHERE id=?",id);}

    @GetMapping("/documents/{documentId}/comments") public List<Map<String,Object>> documentComments(@PathVariable UUID documentId,org.springframework.security.core.Authentication a){UUID org=documentOrg(documentId);member(org,a);return db.queryForList("SELECT c.id,c.content,c.selection_start,c.selection_end,c.resolved,c.created_at,u.name user_name FROM document.comments c JOIN nexus_auth.users u ON u.id=c.user_id WHERE c.document_id=? ORDER BY c.created_at",documentId);}
    @PostMapping("/documents/{documentId}/comments") public Map<String,Object> documentComment(@PathVariable UUID documentId,@Valid @RequestBody CommentRequest r,org.springframework.security.core.Authentication a){UUID org=documentOrg(documentId);member(org,a);UUID id=UUID.randomUUID();db.update("INSERT INTO document.comments(id,document_id,user_id,content,selection_start,selection_end) VALUES(?,?,?,?,?,?)",id,documentId,user(a),r.content().trim(),r.selectionStart(),r.selectionEnd());return db.queryForMap("SELECT id,content,selection_start,selection_end,resolved,created_at FROM document.comments WHERE id=?",id);}
    @PatchMapping("/documents/comments/{commentId}/resolve") public void resolveComment(@PathVariable UUID commentId,org.springframework.security.core.Authentication a){Map<String,Object> row=db.queryForMap("SELECT document_id FROM document.comments WHERE id=?",commentId);member(documentOrg((UUID)row.get("document_id")),a);db.update("UPDATE document.comments SET resolved=true WHERE id=?",commentId);}
    @PostMapping("/documents/{documentId}/restore/{version}") public Map<String,Object> restore(@PathVariable UUID documentId,@PathVariable int version,org.springframework.security.core.Authentication a){UUID org=documentOrg(documentId);member(org,a);Map<String,Object> v=db.queryForMap("SELECT title,content FROM document.document_versions WHERE document_id=? AND version=?",documentId,version);db.update("UPDATE document.documents SET title=?,content=?,version=?,updated_at=now() WHERE id=?",v.get("title"),v.get("content"),version,documentId);return db.queryForMap("SELECT id,title,content,version,team_id,updated_at FROM document.documents WHERE id=?",documentId);}

    @GetMapping("/meetings/{meetingId}/notes") public List<Map<String,Object>> notes(@PathVariable UUID meetingId,org.springframework.security.core.Authentication a){UUID org=meetingOrg(meetingId);member(org,a);return db.queryForList("SELECT n.id,n.content,n.created_at,u.name user_name FROM meeting.notes n JOIN nexus_auth.users u ON u.id=n.user_id WHERE n.meeting_id=? ORDER BY n.created_at",meetingId);}
    @PostMapping("/meetings/{meetingId}/notes") public Map<String,Object> note(@PathVariable UUID meetingId,@Valid @RequestBody CommentRequest r,org.springframework.security.core.Authentication a){UUID org=meetingOrg(meetingId);member(org,a);UUID id=UUID.randomUUID();db.update("INSERT INTO meeting.notes(id,meeting_id,user_id,content) VALUES(?,?,?,?)",id,meetingId,user(a),r.content());return db.queryForMap("SELECT id,content,created_at FROM meeting.notes WHERE id=?",id);}
    @GetMapping("/meetings/{meetingId}/chat") public List<Map<String,Object>> meetingChat(@PathVariable UUID meetingId,org.springframework.security.core.Authentication a){member(meetingOrg(meetingId),a);return db.queryForList("SELECT c.id,c.content,c.created_at,u.name user_name FROM meeting.chat_messages c JOIN nexus_auth.users u ON u.id=c.user_id WHERE c.meeting_id=? ORDER BY c.created_at",meetingId);}
    @PostMapping("/meetings/{meetingId}/chat") public Map<String,Object> meetingMessage(@PathVariable UUID meetingId,@Valid @RequestBody CommentRequest r,org.springframework.security.core.Authentication a){member(meetingOrg(meetingId),a);UUID id=UUID.randomUUID();db.update("INSERT INTO meeting.chat_messages(id,meeting_id,user_id,content) VALUES(?,?,?,?)",id,meetingId,user(a),r.content());return db.queryForMap("SELECT id,content,created_at FROM meeting.chat_messages WHERE id=?",id);}

    @GetMapping("/orgs/{orgId}/whiteboards") public List<Map<String,Object>> boards(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);return db.queryForList("SELECT id,name,team_id,data,created_at,updated_at FROM whiteboard.boards WHERE organization_id=? AND deleted_at IS NULL ORDER BY updated_at DESC",orgId);}
    @PostMapping("/orgs/{orgId}/whiteboards") public Map<String,Object> board(@PathVariable UUID orgId,@Valid @RequestBody BoardRequest r,org.springframework.security.core.Authentication a){member(orgId,a);UUID id=UUID.randomUUID();db.update("INSERT INTO whiteboard.boards(id,organization_id,team_id,name,data,created_by) VALUES(?,?,?,?,'{}'::jsonb,?)",id,orgId,r.teamId(),r.name().trim(),user(a));return db.queryForMap("SELECT id,name,team_id,data,created_at,updated_at FROM whiteboard.boards WHERE id=?",id);}
    @PutMapping("/whiteboards/{id}") public Map<String,Object> updateBoard(@PathVariable UUID id,@Valid @RequestBody BoardUpdate r,org.springframework.security.core.Authentication a){Map<String,Object> row=db.queryForMap("SELECT organization_id FROM whiteboard.boards WHERE id=? AND deleted_at IS NULL",id);member((UUID)row.get("organization_id"),a);db.update("UPDATE whiteboard.boards SET name=?,data=?::jsonb,updated_at=now() WHERE id=?",r.name().trim(),toJson(r.data()),id);return db.queryForMap("SELECT id,name,team_id,data,created_at,updated_at FROM whiteboard.boards WHERE id=?",id);}

    @PostMapping(value="/ai/chat", consumes=MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> ai(@Valid @RequestBody AiRequest request, org.springframework.security.core.Authentication a) {
        user(a);
        if (nemotronKey.isBlank()) return Map.of("configured", false, "answer", "Nemotron is not configured on the backend yet. Add NEMOTRON_API_KEY to Render and retry.");
        Map<String,Object> body=Map.of("model",nemotronModel,"messages",List.of(Map.of("role","system","content","You are Nexus AI, a concise enterprise workspace assistant. Use the supplied workspace context, never invent records, and clearly say when data is missing."),Map.of("role","user","content",request.message()+"\n\nWorkspace context:\n"+Objects.toString(request.context(),"No additional context."))),"temperature",0.2,"max_tokens",1200);
        Map<?,?> response=RestClient.create().post().uri(nemotronUrl).header("Authorization","Bearer "+nemotronKey).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class);
        Object choices=response==null?null:response.get("choices"); if (!(choices instanceof List<?> list) || list.isEmpty()) throw new IllegalStateException("Nemotron returned no answer.");
        Object first=list.get(0); Object message=first instanceof Map<?,?> map?map.get("message"):null; Object content=message instanceof Map<?,?> map?map.get("content"):null;
        return Map.of("configured",true,"answer",Objects.toString(content,"Nemotron returned an empty answer."));
    }

    private UUID user(org.springframework.security.core.Authentication a){return UUID.fromString(a.getName());}
    private void member(UUID org,org.springframework.security.core.Authentication a){organizations.requireMember(org,user(a));}
    private void admin(UUID org,org.springframework.security.core.Authentication a){member(org,a);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,user(a));if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private UUID channelOrg(UUID channel){return db.queryForObject("SELECT organization_id FROM chat.channels WHERE id=? AND deleted_at IS NULL",UUID.class,channel);}
    private UUID teamOrg(UUID team){return db.queryForObject("SELECT organization_id FROM org.teams WHERE id=?",UUID.class,team);}
    private UUID taskOrg(UUID task){return db.queryForObject("SELECT organization_id FROM project.tasks WHERE id=? AND deleted_at IS NULL",UUID.class,task);}
    private UUID documentOrg(UUID doc){return db.queryForObject("SELECT organization_id FROM document.documents WHERE id=? AND deleted_at IS NULL",UUID.class,doc);}
    private UUID meetingOrg(UUID meeting){return db.queryForObject("SELECT organization_id FROM meeting.meetings WHERE id=? AND deleted_at IS NULL",UUID.class,meeting);}
    private String toJson(Object value){try{return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value==null?List.of():value);}catch(Exception e){throw new IllegalArgumentException("Invalid JSON payload.",e);}}
}
