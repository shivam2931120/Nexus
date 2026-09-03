package com.nexus.workspace;

import com.nexus.org.OrganizationController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.*;
import com.nexus.enterprise.InvitationMailService;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
    private final JdbcTemplate db;
    private final OrganizationController organizations;
    private final InvitationMailService mail;

    public WorkspaceController(JdbcTemplate db, OrganizationController organizations, InvitationMailService mail) { this.db = db; this.organizations = organizations; this.mail = mail; }

    record CreateEvent(@NotBlank String title, String description, OffsetDateTime startsAt, OffsetDateTime endsAt, String kind, UUID teamId, String recurrenceRule, String location, List<Integer> reminderMinutes, UUID resourceId) {}
    record CreateFile(@NotBlank String name, String objectKey, String mimeType, Long sizeBytes, UUID teamId) {}
    record CreateInvitation(@Email @NotBlank String email, String role) {}

    @GetMapping("/bootstrap")
    @Transactional
    public Map<String,Object> bootstrap(@RequestParam(required=false) UUID orgId, org.springframework.security.core.Authentication auth) {
        UUID uid = user(auth);
        db.queryForObject("SELECT pg_advisory_xact_lock(hashtext(?))", Object.class, uid.toString());
        List<Map<String,Object>> memberships = db.queryForList("SELECT o.id,o.name,o.slug,m.role FROM org.organizations o JOIN org.memberships m ON m.organization_id=o.id WHERE m.user_id=? AND o.deleted_at IS NULL ORDER BY o.created_at", uid);
        UUID activeOrgId;
        String orgName;
        String role;
        if (orgId != null && memberships.stream().noneMatch(row -> orgId.equals(row.get("id")))) throw new SecurityException("You do not have access to this organization.");
        if (memberships.isEmpty()) {
            activeOrgId = UUID.randomUUID();
            orgName = "My workspace";
            String slug = "my-workspace-" + activeOrgId.toString().substring(0, 8);
            db.update("INSERT INTO org.organizations(id,name,slug) VALUES (?,?,?)", activeOrgId, orgName, slug);
            db.update("INSERT INTO org.memberships(id,organization_id,user_id,role) VALUES (?,?,?,?)", UUID.randomUUID(), activeOrgId, uid, "OWNER");
            role = "OWNER";
            audit(activeOrgId, uid, "workspace.created", "organization", activeOrgId);
        } else {
            Map<String,Object> row = orgId == null ? memberships.get(0) : memberships.stream().filter(item -> orgId.equals(item.get("id"))).findFirst().orElse(memberships.get(0));
            activeOrgId = (UUID) row.get("id"); orgName = (String) row.get("name"); role = (String) row.get("role");
        }
        List<Map<String,Object>> teams = db.queryForList("SELECT t.id,t.name,t.description FROM org.teams t JOIN org.team_members tm ON tm.team_id=t.id WHERE t.organization_id=? AND t.deleted_at IS NULL AND tm.user_id=? ORDER BY t.created_at", activeOrgId, uid);
        UUID teamId;
        if (teams.isEmpty()) {
            List<UUID> general = db.query("SELECT id FROM org.teams WHERE organization_id=? AND deleted_at IS NULL AND lower(name)='general' ORDER BY created_at LIMIT 1", (rs,row)->UUID.fromString(rs.getString(1)), activeOrgId);
            teamId = general.isEmpty() ? UUID.randomUUID() : general.get(0);
            if (general.isEmpty()) {
                db.update("INSERT INTO org.teams(id,organization_id,name,description) VALUES (?,?,?,?)", teamId, activeOrgId, "General", "Default workspace team");
                db.update("INSERT INTO chat.channels(id,organization_id,team_id,name,type) VALUES (?,?,?,?,?)", UUID.randomUUID(), activeOrgId, teamId, "general", "PUBLIC");
            }
            db.update("INSERT INTO org.team_members(team_id,user_id) VALUES (?,?)", teamId, uid);
            teams = db.queryForList("SELECT id,name,description FROM org.teams WHERE id=?", teamId);
        } else {
            teamId = (UUID) teams.get(0).get("id");
        }
        List<Map<String,Object>> channels = db.queryForList("SELECT c.id,c.name,c.type,c.team_id FROM chat.channels c WHERE c.organization_id=? AND c.deleted_at IS NULL AND (c.team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=c.team_id AND tm.user_id=?)) AND (c.type<>'PRIVATE' OR EXISTS (SELECT 1 FROM chat.channel_members cm WHERE cm.channel_id=c.id AND cm.user_id=?)) ORDER BY c.name", activeOrgId, uid, uid);
        return Map.of("user", db.queryForMap("SELECT id,email,name FROM nexus_auth.users WHERE id=?", uid), "organization", Map.of("id", activeOrgId, "name", orgName, "role", role), "team", teams.get(0), "channels", channels);
    }

    @GetMapping("/orgs/{orgId}/events") public List<Map<String,Object>> events(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,title,description,starts_at,ends_at,kind,team_id,recurrence_rule,location,reminder_minutes,sync_status,google_event_id FROM calendar.events e WHERE organization_id=? AND deleted_at IS NULL AND (team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=e.team_id AND tm.user_id=?)) ORDER BY starts_at", orgId,user(a)); }
    @PostMapping("/orgs/{orgId}/events") public Map<String,Object> createEvent(@PathVariable UUID orgId, @Valid @RequestBody CreateEvent r, org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); team(orgId,r.teamId(),uid); UUID id=UUID.randomUUID(); OffsetDateTime start=Objects.requireNonNullElse(r.startsAt(), OffsetDateTime.now()); OffsetDateTime end=Objects.requireNonNullElse(r.endsAt(), start.plusHours(1)); if(!end.isAfter(start))throw new IllegalArgumentException("Event end time must be after its start time."); db.update("INSERT INTO calendar.events(id,organization_id,team_id,title,description,starts_at,ends_at,kind,created_by,recurrence_rule,location,reminder_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", id,orgId,r.teamId(),r.title().trim(),Objects.toString(r.description(),""),start,end,Objects.toString(r.kind(),"WORK"),uid,r.recurrenceRule(),r.location(),r.reminderMinutes()==null?new Integer[0]:r.reminderMinutes().toArray(Integer[]::new));if(r.resourceId()!=null){if(db.queryForObject("SELECT count(*) FROM calendar.resource_bookings b JOIN calendar.resources x ON x.id=b.resource_id WHERE x.id=? AND x.organization_id=? AND b.starts_at<? AND b.ends_at>?",Integer.class,r.resourceId(),orgId,end,start)>0)throw new IllegalArgumentException("The selected resource is already booked.");db.update("INSERT INTO calendar.resource_bookings(id,resource_id,event_id,starts_at,ends_at) VALUES(?,?,?,?,?)",UUID.randomUUID(),r.resourceId(),id,start,end);} audit(orgId,uid,"event.created","event",id); return db.queryForMap("SELECT id,title,description,starts_at,ends_at,kind,team_id,recurrence_rule,location,reminder_minutes,sync_status FROM calendar.events WHERE id=?",id); }
    @DeleteMapping("/events/{id}") public void deleteEvent(@PathVariable UUID id, org.springframework.security.core.Authentication a) { Map<String,Object> e=db.queryForMap("SELECT organization_id FROM calendar.events WHERE id=? AND deleted_at IS NULL",id); member((UUID)e.get("organization_id"),a); db.update("UPDATE calendar.events SET deleted_at=now() WHERE id=?",id); audit((UUID)e.get("organization_id"),user(a),"event.deleted","event",id); }

    @GetMapping("/orgs/{orgId}/files") public List<Map<String,Object>> files(@PathVariable UUID orgId,@RequestParam(required=false) UUID folderId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,name,object_key,mime_type,size_bytes,created_at,updated_at,team_id,folder_id,current_version FROM nexus_storage.files f WHERE organization_id=? AND deleted_at IS NULL AND folder_id IS NOT DISTINCT FROM ? AND (team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=f.team_id AND tm.user_id=?)) ORDER BY updated_at DESC",orgId,folderId,user(a)); }
    @PostMapping("/orgs/{orgId}/files") public Map<String,Object> createFile(@PathVariable UUID orgId,@Valid @RequestBody CreateFile r,org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); team(orgId,r.teamId(),uid); UUID id=UUID.randomUUID(); String key=Objects.requireNonNullElse(r.objectKey(),orgId+"/"+id+"/"+r.name()); db.update("INSERT INTO nexus_storage.files(id,organization_id,team_id,name,object_key,mime_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?,?)",id,orgId,r.teamId(),r.name().trim(),key,Objects.requireNonNullElse(r.mimeType(),"application/octet-stream"),Objects.requireNonNullElse(r.sizeBytes(),0L),uid); audit(orgId,uid,"file.created","file",id); return db.queryForMap("SELECT id,name,object_key,mime_type,size_bytes,created_at,team_id FROM nexus_storage.files WHERE id=?",id); }
    @DeleteMapping("/files/{id}") public void deleteFile(@PathVariable UUID id,org.springframework.security.core.Authentication a){Map<String,Object> f=db.queryForMap("SELECT organization_id FROM nexus_storage.files WHERE id=? AND deleted_at IS NULL",id);member((UUID)f.get("organization_id"),a);db.update("UPDATE nexus_storage.files SET deleted_at=now() WHERE id=?",id);audit((UUID)f.get("organization_id"),user(a),"file.deleted","file",id);}

    @GetMapping("/orgs/{orgId}/invitations") public List<Map<String,Object>> invitations(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);return db.queryForList("SELECT id,email,role,status,created_at,expires_at FROM org.invitations WHERE organization_id=? ORDER BY created_at DESC",orgId);}
    @PostMapping("/orgs/{orgId}/invitations") public Map<String,Object> invite(@PathVariable UUID orgId,@Valid @RequestBody CreateInvitation r,org.springframework.security.core.Authentication a){UUID uid=user(a);admin(orgId,uid);UUID id=UUID.randomUUID();db.update("INSERT INTO org.invitations(id,organization_id,email,role,invited_by) VALUES(?,?,?,?,?)",id,orgId,r.email(),Objects.requireNonNullElse(r.role(),"MEMBER"));String orgName=db.queryForObject("SELECT name FROM org.organizations WHERE id=?",String.class,orgId);boolean delivered=mail.send(r.email(),orgName);db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),orgId,uid,"INVITATION","Invitation created",(delivered?"Invitation email sent to ":"Invitation recorded for ")+r.email());audit(orgId,uid,"invitation.created","invitation",id);return db.queryForMap("SELECT id,email,role,status,created_at,expires_at FROM org.invitations WHERE id=?",id);}

    @GetMapping("/notifications") public List<Map<String,Object>> notifications(org.springframework.security.core.Authentication a){return db.queryForList("SELECT id,organization_id,type,title,body,read_at,created_at FROM notification.notifications WHERE user_id=? ORDER BY created_at DESC",user(a));}
    @PatchMapping("/notifications/{id}/read") public void read(@PathVariable UUID id,org.springframework.security.core.Authentication a){db.update("UPDATE notification.notifications SET read_at=now() WHERE id=? AND user_id=?",id,user(a));}
    @GetMapping("/notifications/preferences") public Map<String,Object> preferences(org.springframework.security.core.Authentication a){UUID uid=user(a);db.update("INSERT INTO notification.preferences(user_id) VALUES(?) ON CONFLICT(user_id) DO NOTHING",uid);return db.queryForMap("SELECT email_enabled,push_enabled,task_enabled,mention_enabled,meeting_enabled,document_enabled,do_not_disturb FROM notification.preferences WHERE user_id=?",uid);}
    @PutMapping("/notifications/preferences") public Map<String,Object> updatePreferences(@RequestBody Map<String,Object> body,org.springframework.security.core.Authentication a){UUID uid=user(a);db.update("INSERT INTO notification.preferences(user_id,email_enabled,push_enabled,task_enabled,mention_enabled,meeting_enabled,document_enabled,do_not_disturb) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,push_enabled=EXCLUDED.push_enabled,task_enabled=EXCLUDED.task_enabled,mention_enabled=EXCLUDED.mention_enabled,meeting_enabled=EXCLUDED.meeting_enabled,document_enabled=EXCLUDED.document_enabled,do_not_disturb=EXCLUDED.do_not_disturb,updated_at=now()",uid,flag(body,"emailEnabled"),flag(body,"pushEnabled"),flag(body,"taskEnabled"),flag(body,"mentionEnabled"),flag(body,"meetingEnabled"),flag(body,"documentEnabled"),flag(body,"doNotDisturb"));return preferences(a);}
    @GetMapping("/orgs/{orgId}/audit") public List<Map<String,Object>> auditLog(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){admin(orgId,user(a));return db.queryForList("SELECT id,actor_id,action,entity_type,entity_id,metadata,created_at FROM audit.events WHERE organization_id=? ORDER BY created_at DESC LIMIT 200",orgId);}

    private UUID user(org.springframework.security.core.Authentication a){return UUID.fromString(a.getName());}
    private boolean flag(Map<String,Object> body,String key){return !Boolean.FALSE.equals(body.get(key));}
    private void member(UUID org,org.springframework.security.core.Authentication a){organizations.requireMember(org,user(a));}
    private void admin(UUID org,UUID uid){organizations.requireMember(org,uid);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,uid);if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private void team(UUID org,UUID team,UUID uid){if(team!=null&&db.queryForObject("SELECT count(*) FROM org.teams t JOIN org.team_members tm ON tm.team_id=t.id WHERE t.id=? AND t.organization_id=? AND t.deleted_at IS NULL AND tm.user_id=?",Integer.class,team,org,uid)==0)throw new SecurityException("You do not have access to this team.");}
    private void audit(UUID org,UUID actor,String action,String type,UUID id){db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,actor,action,type,id);}
}
