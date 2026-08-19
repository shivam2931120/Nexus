package com.nexus.document;

import com.nexus.enterprise.InvitationMailService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class DocumentController {
    private final JdbcTemplate db;
    private final InvitationMailService mail;

    public DocumentController(JdbcTemplate db, InvitationMailService mail) {
        this.db = db;
        this.mail = mail;
    }

    record CreateDoc(@NotBlank String title, String content, UUID teamId) {}
    record UpdateDoc(@NotBlank String title, String content) {}

    @GetMapping("/orgs/{orgId}/documents")
    public List<Map<String, Object>> list(@PathVariable UUID orgId, Authentication authentication) {
        UUID userId = user(authentication);
        member(orgId, userId);
        return db.queryForList("""
                SELECT d.id,d.title,d.content,d.version,d.team_id,d.created_by,d.updated_at,
                       CASE WHEN d.created_by=? OR EXISTS (
                         SELECT 1 FROM org.memberships m
                         WHERE m.organization_id=d.organization_id AND m.user_id=? AND m.role IN ('OWNER','ADMIN')
                       ) THEN true ELSE false END AS can_manage
                FROM document.documents d
                WHERE d.organization_id=? AND d.deleted_at IS NULL
                  AND (d.team_id IS NULL OR EXISTS (
                    SELECT 1 FROM org.team_members tm WHERE tm.team_id=d.team_id AND tm.user_id=?
                  ))
                ORDER BY d.updated_at DESC
                """, userId, userId, orgId, userId);
    }

    @PostMapping("/orgs/{orgId}/documents")
    public Map<String, Object> create(@PathVariable UUID orgId, @Valid @RequestBody CreateDoc request,
                                      Authentication authentication) {
        UUID userId = user(authentication);
        member(orgId, userId);
        team(orgId, request.teamId(), userId);
        UUID id = UUID.randomUUID();
        String title = request.title().trim();
        String content = Objects.toString(request.content(), "");
        db.update("INSERT INTO document.documents(id,organization_id,team_id,title,content,created_by) VALUES(?,?,?,?,?,?)",
                id, orgId, request.teamId(), title, content, userId);
        db.update("INSERT INTO document.document_versions(id,document_id,version,title,content,created_by) VALUES(?,?,?,?,?,?)",
                UUID.randomUUID(), id, 1, title, content, userId);
        audit(orgId, userId, "document.created", id);
        return get(id, authentication);
    }

    @GetMapping("/documents/{id}")
    public Map<String, Object> get(@PathVariable UUID id, Authentication authentication) {
        Map<String, Object> document = document(id);
        UUID userId = user(authentication);
        UUID orgId = (UUID) document.get("organization_id");
        member(orgId, userId);
        team(orgId, (UUID) document.get("team_id"), userId);
        document.put("can_manage", canManage(document, userId));
        return document;
    }

    @PutMapping("/documents/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody UpdateDoc request,
                                      Authentication authentication) {
        UUID userId = user(authentication);
        Map<String, Object> document = get(id, authentication);
        int version = ((Number) document.get("version")).intValue() + 1;
        String title = request.title().trim();
        String content = Objects.toString(request.content(), "");
        db.update("UPDATE document.documents SET title=?,content=?,version=?,updated_at=now() WHERE id=?",
                title, content, version, id);
        db.update("INSERT INTO document.document_versions(id,document_id,version,title,content,created_by) VALUES(?,?,?,?,?,?)",
                UUID.randomUUID(), id, version, title, content, userId);
        audit((UUID) document.get("organization_id"), userId, "document.updated", id);
        return get(id, authentication);
    }

    @GetMapping("/documents/{id}/versions")
    public List<Map<String, Object>> versions(@PathVariable UUID id, Authentication authentication) {
        get(id, authentication);
        return db.queryForList("SELECT id,version,title,created_by,created_at FROM document.document_versions WHERE document_id=? ORDER BY version DESC", id);
    }

    @DeleteMapping("/documents/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, Authentication authentication) {
        UUID userId = user(authentication);
        Map<String, Object> document = get(id, authentication);
        requireManager(document, userId);
        db.update("UPDATE document.documents SET deleted_at=now(),updated_at=now() WHERE id=?", id);
        audit((UUID) document.get("organization_id"), userId, "document.deleted", id);
    }

    @PostMapping("/documents/{id}/notify")
    public Map<String, Object> notifyMembers(@PathVariable UUID id, Authentication authentication) {
        UUID userId = user(authentication);
        Map<String, Object> document = get(id, authentication);
        requireManager(document, userId);
        UUID orgId = (UUID) document.get("organization_id");
        UUID teamId = (UUID) document.get("team_id");
        String organizationName = db.queryForObject("SELECT name FROM org.organizations WHERE id=?", String.class, orgId);
        String senderName = db.queryForObject("SELECT name FROM nexus_auth.users WHERE id=?", String.class, userId);
        List<String> recipients = teamId == null
                ? db.queryForList("SELECT u.email FROM org.memberships m JOIN nexus_auth.users u ON u.id=m.user_id WHERE m.organization_id=?", String.class, orgId)
                : db.queryForList("SELECT u.email FROM org.team_members tm JOIN nexus_auth.users u ON u.id=tm.user_id WHERE tm.team_id=?", String.class, teamId);
        int sent = mail.sendDocument(recipients, organizationName, Objects.toString(document.get("title"), "Untitled document"), id, senderName);
        audit(orgId, userId, "document.members_notified", id);
        return Map.of("recipients", recipients.size(), "sent", sent, "configured", mail.configured());
    }

    private Map<String, Object> document(UUID id) {
        return db.queryForMap("SELECT * FROM document.documents WHERE id=? AND deleted_at IS NULL", id);
    }

    private UUID user(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }

    private void member(UUID orgId, UUID userId) {
        if (db.queryForObject("SELECT count(*) FROM org.memberships WHERE organization_id=? AND user_id=?", Integer.class, orgId, userId) == 0) {
            throw new SecurityException("You do not have access to this workspace.");
        }
    }

    private void team(UUID orgId, UUID teamId, UUID userId) {
        if (teamId != null && db.queryForObject("SELECT count(*) FROM org.teams t JOIN org.team_members tm ON tm.team_id=t.id WHERE t.id=? AND t.organization_id=? AND t.deleted_at IS NULL AND tm.user_id=?", Integer.class, teamId, orgId, userId) == 0) {
            throw new SecurityException("You do not have access to this team.");
        }
    }

    private boolean canManage(Map<String, Object> document, UUID userId) {
        if (userId.equals(document.get("created_by"))) return true;
        String role = db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",
                String.class, document.get("organization_id"), userId);
        return "OWNER".equals(role) || "ADMIN".equals(role);
    }

    private void requireManager(Map<String, Object> document, UUID userId) {
        if (!canManage(document, userId)) {
            throw new SecurityException("Only the document owner or a workspace administrator can perform this action.");
        }
    }

    private void audit(UUID orgId, UUID actorId, String action, UUID documentId) {
        db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)",
                UUID.randomUUID(), orgId, actorId, action, "document", documentId);
    }
}
