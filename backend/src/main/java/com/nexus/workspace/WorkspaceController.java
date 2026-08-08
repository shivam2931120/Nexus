package com.nexus.workspace;

import com.nexus.org.OrganizationController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

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

    record CreateEvent(@NotBlank String title, String description, OffsetDateTime startsAt, OffsetDateTime endsAt, String kind, UUID teamId) {}
    record CreateFile(@NotBlank String name, String objectKey, String mimeType, Long sizeBytes, UUID teamId) {}
    record CreateInvitation(@Email @NotBlank String email, String role) {}

    @GetMapping("/bootstrap")
    public Map<String,Object> bootstrap(@RequestParam(required=false) UUID orgId, org.springframework.security.core.Authentication auth) {
        UUID uid = user(auth);
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
        List<Map<String,Object>> teams = db.queryForList("SELECT id,name,description FROM org.teams WHERE organization_id=? AND deleted_at IS NULL ORDER BY created_at", activeOrgId);
        UUID teamId;
        if (teams.isEmpty()) {
            teamId = UUID.randomUUID();
            db.update("INSERT INTO org.teams(id,organization_id,name,description) VALUES (?,?,?,?)", teamId, activeOrgId, "General", "Default workspace team");
            db.update("INSERT INTO org.team_members(team_id,user_id) VALUES (?,?)", teamId, uid);
            db.update("INSERT INTO chat.channels(id,organization_id,team_id,name,type) VALUES (?,?,?,?,?)", UUID.randomUUID(), activeOrgId, teamId, "general", "PUBLIC");
            teams = db.queryForList("SELECT id,name,description FROM org.teams WHERE id=?", teamId);
        } else {
            teamId = (UUID) teams.get(0).get("id");
            if (db.queryForObject("SELECT count(*) FROM org.team_members WHERE team_id=? AND user_id=?", Integer.class, teamId, uid) == 0) db.update("INSERT INTO org.team_members(team_id,user_id) VALUES (?,?)", teamId, uid);
        }
        List<Map<String,Object>> channels = db.queryForList("SELECT id,name,type,team_id FROM chat.channels WHERE organization_id=? AND deleted_at IS NULL ORDER BY name", activeOrgId);
        return Map.of("user", db.queryForMap("SELECT id,email,name FROM nexus_auth.users WHERE id=?", uid), "organization", Map.of("id", activeOrgId, "name", orgName, "role", role), "team", teams.get(0), "channels", channels);
    }

    @GetMapping("/orgs/{orgId}/events") public List<Map<String,Object>> events(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,title,description,starts_at,ends_at,kind,team_id FROM calendar.events WHERE organization_id=? AND deleted_at IS NULL ORDER BY starts_at", orgId); }
    @PostMapping("/orgs/{orgId}/events") public Map<String,Object> createEvent(@PathVariable UUID orgId, @Valid @RequestBody CreateEvent r, org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); UUID id=UUID.randomUUID(); OffsetDateTime start=Objects.requireNonNullElse(r.startsAt(), OffsetDateTime.now()); OffsetDateTime end=Objects.requireNonNullElse(r.endsAt(), start.plusHours(1)); db.update("INSERT INTO calendar.events(id,organization_id,team_id,title,description,starts_at,ends_at,kind,created_by) VALUES(?,?,?,?,?,?,?,?,?)", id,orgId,r.teamId(),r.title(),Objects.toString(r.description(),""),start,end,Objects.toString(r.kind(),"WORK"),uid); audit(orgId,uid,"event.created","event",id); return db.queryForMap("SELECT id,title,description,starts_at,ends_at,kind,team_id FROM calendar.events WHERE id=?",id); }
    @DeleteMapping("/events/{id}") public void deleteEvent(@PathVariable UUID id, org.springframework.security.core.Authentication a) { Map<String,Object> e=db.queryForMap("SELECT organization_id FROM calendar.events WHERE id=? AND deleted_at IS NULL",id); member((UUID)e.get("organization_id"),a); db.update("UPDATE calendar.events SET deleted_at=now() WHERE id=?",id); audit((UUID)e.get("organization_id"),user(a),"event.deleted","event",id); }

    @GetMapping("/orgs/{orgId}/files") public List<Map<String,Object>> files(@PathVariable UUID orgId, org.springframework.security.core.Authentication a) { member(orgId,a); return db.queryForList("SELECT id,name,object_key,mime_type,size_bytes,created_at,team_id FROM nexus_storage.files WHERE organization_id=? AND deleted_at IS NULL ORDER BY created_at DESC",orgId); }
    @PostMapping("/orgs/{orgId}/files") public Map<String,Object> createFile(@PathVariable UUID orgId,@Valid @RequestBody CreateFile r,org.springframework.security.core.Authentication a) { UUID uid=user(a); member(orgId,a); UUID id=UUID.randomUUID(); String key=Objects.requireNonNullElse(r.objectKey(),orgId+"/"+id+"/"+r.name()); db.update("INSERT INTO nexus_storage.files(id,organization_id,team_id,name,object_key,mime_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?,?)",id,orgId,r.teamId(),r.name(),key,Objects.requireNonNullElse(r.mimeType(),"application/octet-stream"),Objects.requireNonNullElse(r.sizeBytes(),0L),uid); audit(orgId,uid,"file.created","file",id); return db.queryForMap("SELECT id,name,object_key,mime_type,size_bytes,created_at,team_id FROM nexus_storage.files WHERE id=?",id); }
    @DeleteMapping("/files/{id}") public void deleteFile(@PathVariable UUID id,org.springframework.security.core.Authentication a){Map<String,Object> f=db.queryForMap("SELECT organization_id FROM nexus_storage.files WHERE id=? AND deleted_at IS NULL",id);member((UUID)f.get("organization_id"),a);db.update("UPDATE nexus_storage.files SET deleted_at=now() WHERE id=?",id);audit((UUID)f.get("organization_id"),user(a),"file.deleted","file",id);}

    @GetMapping("/orgs/{orgId}/invitations") public List<Map<String,Object>> invitations(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);return db.queryForList("SELECT id,email,role,status,created_at,expires_at FROM org.invitations WHERE organization_id=? ORDER BY created_at DESC",orgId);}
    @PostMapping("/orgs/{orgId}/invitations") public Map<String,Object> invite(@PathVariable UUID orgId,@Valid @RequestBody CreateInvitation r,org.springframework.security.core.Authentication a){UUID uid=user(a);admin(orgId,uid);UUID id=UUID.randomUUID();db.update("INSERT INTO org.invitations(id,organization_id,email,role,invited_by) VALUES(?,?,?,?,?)",id,orgId,r.email(),Objects.requireNonNullElse(r.role(),"MEMBER"));String orgName=db.queryForObject("SELECT name FROM org.organizations WHERE id=?",String.class,orgId);boolean delivered=mail.send(r.email(),orgName);db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),orgId,uid,"INVITATION","Invitation created",(delivered?"Invitation email sent to ":"Invitation recorded for ")+r.email());audit(orgId,uid,"invitation.created","invitation",id);return db.queryForMap("SELECT id,email,role,status,created_at,expires_at FROM org.invitations WHERE id=?",id);}

    @GetMapping("/notifications") public List<Map<String,Object>> notifications(org.springframework.security.core.Authentication a){return db.queryForList("SELECT id,organization_id,type,title,body,read_at,created_at FROM notification.notifications WHERE user_id=? ORDER BY created_at DESC",user(a));}
    @PatchMapping("/notifications/{id}/read") public void read(@PathVariable UUID id,org.springframework.security.core.Authentication a){db.update("UPDATE notification.notifications SET read_at=now() WHERE id=? AND user_id=?",id,user(a));}
    @GetMapping("/orgs/{orgId}/audit") public List<Map<String,Object>> auditLog(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){admin(orgId,user(a));return db.queryForList("SELECT id,actor_id,action,entity_type,entity_id,metadata,created_at FROM audit.events WHERE organization_id=? ORDER BY created_at DESC LIMIT 200",orgId);}

    private UUID user(org.springframework.security.core.Authentication a){return UUID.fromString(a.getName());}
    private void member(UUID org,org.springframework.security.core.Authentication a){organizations.requireMember(org,user(a));}
    private void admin(UUID org,UUID uid){organizations.requireMember(org,uid);String role=db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",String.class,org,uid);if(!Set.of("OWNER","ADMIN").contains(role))throw new SecurityException("Administrator access is required.");}
    private void audit(UUID org,UUID actor,String action,String type,UUID id){db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),org,actor,action,type,id);}
}
