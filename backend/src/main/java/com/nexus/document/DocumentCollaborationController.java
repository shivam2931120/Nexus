package com.nexus.document;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents/{documentId}")
public class DocumentCollaborationController {
    private final JdbcTemplate db;
    private final SimpMessagingTemplate messages;

    public DocumentCollaborationController(JdbcTemplate db, SimpMessagingTemplate messages) {
        this.db = db;
        this.messages = messages;
    }

    record CreateComment(@NotBlank String content, UUID parentId, Integer selectionStart, Integer selectionEnd) {}
    record UpdateComment(String content, Boolean resolved) {}

    @GetMapping("/comments")
    public List<Map<String, Object>> comments(@PathVariable UUID documentId, Authentication authentication) {
        access(documentId, user(authentication), false);
        return db.queryForList("""
                SELECT c.id,c.document_id,c.user_id,c.parent_id,c.content,c.selection_start,c.selection_end,
                       c.resolved,c.resolved_by,c.resolved_at,c.created_at,c.updated_at,u.name author_name,u.email author_email
                FROM document.comments c JOIN nexus_auth.users u ON u.id=c.user_id
                WHERE c.document_id=? ORDER BY c.created_at
                """, documentId);
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> comment(@PathVariable UUID documentId, @Valid @RequestBody CreateComment request,
                                       Authentication authentication) {
        UUID userId = user(authentication);
        access(documentId, userId, false);
        if (request.parentId() != null && db.queryForObject(
                "SELECT count(*) FROM document.comments WHERE id=? AND document_id=?", Integer.class,
                request.parentId(), documentId) == 0) {
            throw new IllegalArgumentException("Reply target is not part of this document.");
        }
        UUID id = UUID.randomUUID();
        db.update("""
                INSERT INTO document.comments(id,document_id,user_id,parent_id,content,selection_start,selection_end)
                VALUES(?,?,?,?,?,?,?)
                """, id, documentId, userId, request.parentId(), request.content().trim(),
                request.selectionStart(), request.selectionEnd());
        Map<String, Object> result = comment(id);
        messages.convertAndSend("/topic/document." + documentId + ".comments", result);
        return result;
    }

    @PatchMapping("/comments/{commentId}")
    public Map<String, Object> updateComment(@PathVariable UUID documentId, @PathVariable UUID commentId,
                                             @RequestBody UpdateComment request, Authentication authentication) {
        UUID userId = user(authentication);
        Map<String, Object> document = access(documentId, userId, false);
        Map<String, Object> existing = db.queryForMap(
                "SELECT user_id FROM document.comments WHERE id=? AND document_id=?", commentId, documentId);
        boolean manager = canManage(document, userId);
        if (request.content() != null && !userId.equals(existing.get("user_id")) && !manager) {
            throw new SecurityException("Only the comment author or a document manager can edit this comment.");
        }
        if (request.content() != null) {
            String content = request.content().trim();
            if (content.isBlank()) throw new IllegalArgumentException("Comment content is required.");
            db.update("UPDATE document.comments SET content=?,updated_at=now() WHERE id=?", content, commentId);
        }
        if (request.resolved() != null) {
            db.update("""
                    UPDATE document.comments
                    SET resolved=?,resolved_by=?,resolved_at=CASE WHEN ? THEN now() ELSE NULL END,updated_at=now()
                    WHERE id=?
                    """, request.resolved(), request.resolved() ? userId : null,
                    request.resolved(), commentId);
        }
        Map<String, Object> result = comment(commentId);
        messages.convertAndSend("/topic/document." + documentId + ".comments", result);
        return result;
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable UUID documentId, @PathVariable UUID commentId,
                              Authentication authentication) {
        UUID userId = user(authentication);
        Map<String, Object> document = access(documentId, userId, false);
        UUID authorId = db.queryForObject(
                "SELECT user_id FROM document.comments WHERE id=? AND document_id=?", UUID.class, commentId, documentId);
        if (!userId.equals(authorId) && !canManage(document, userId)) {
            throw new SecurityException("Only the comment author or a document manager can delete this comment.");
        }
        db.update("DELETE FROM document.comments WHERE id=? AND document_id=?", commentId, documentId);
        messages.convertAndSend("/topic/document." + documentId + ".comments",
                Map.of("id", commentId, "deleted", true));
    }

    private Map<String, Object> comment(UUID id) {
        return db.queryForMap("""
                SELECT c.id,c.document_id,c.user_id,c.parent_id,c.content,c.selection_start,c.selection_end,
                       c.resolved,c.resolved_by,c.resolved_at,c.created_at,c.updated_at,u.name author_name,u.email author_email
                FROM document.comments c JOIN nexus_auth.users u ON u.id=c.user_id WHERE c.id=?
                """, id);
    }

    private Map<String, Object> access(UUID documentId, UUID userId, boolean requireEdit) {
        Map<String, Object> document = db.queryForMap(
                "SELECT * FROM document.documents WHERE id=? AND deleted_at IS NULL", documentId);
        UUID orgId = (UUID) document.get("organization_id");
        UUID teamId = (UUID) document.get("team_id");
        int allowed = db.queryForObject("""
                SELECT count(*) FROM org.memberships m
                WHERE m.organization_id=? AND m.user_id=? AND
                  (?::uuid IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=? AND tm.user_id=?))
                """, Integer.class, orgId, userId, teamId, teamId, userId);
        if (allowed == 0) throw new SecurityException("You do not have access to this document.");
        if (requireEdit && !canManage(document, userId)) {
            throw new SecurityException("You do not have permission to edit this document.");
        }
        return document;
    }

    private boolean canManage(Map<String, Object> document, UUID userId) {
        if (userId.equals(document.get("created_by"))) return true;
        String role = db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?",
                String.class, document.get("organization_id"), userId);
        return "OWNER".equals(role) || "ADMIN".equals(role);
    }

    private UUID user(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
