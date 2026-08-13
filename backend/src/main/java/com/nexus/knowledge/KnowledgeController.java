package com.nexus.knowledge;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class KnowledgeController {
    private final JdbcTemplate db;

    public KnowledgeController(JdbcTemplate db) { this.db = db; }

    record CreatePage(@NotBlank String title, String content, UUID teamId, UUID parentId, String visibility) {}
    record UpdatePage(@NotBlank String title, String content, UUID parentId, String visibility) {}

    @GetMapping("/orgs/{orgId}/knowledge")
    public List<Map<String, Object>> list(@PathVariable UUID orgId, @RequestParam(required = false) String q, org.springframework.security.core.Authentication auth) {
        member(orgId, auth);
        String term = q == null ? "" : q.trim().toLowerCase();
        return db.queryForList("SELECT id,title,content,team_id,parent_id,visibility,created_by,created_at,updated_at FROM knowledge.pages WHERE organization_id=? AND deleted_at IS NULL AND (?='' OR lower(title) LIKE ? OR lower(content) LIKE ?) ORDER BY parent_id NULLS FIRST, title", orgId, term, "%" + term + "%", "%" + term + "%");
    }

    @PostMapping("/orgs/{orgId}/knowledge")
    public Map<String, Object> create(@PathVariable UUID orgId, @Valid @RequestBody CreatePage request, org.springframework.security.core.Authentication auth) {
        UUID userId = user(auth);
        member(orgId, auth);
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO knowledge.pages(id,organization_id,team_id,parent_id,title,content,visibility,created_by) VALUES(?,?,?,?,?,?,?,?)", id, orgId, request.teamId(), request.parentId(), request.title().trim(), Objects.toString(request.content(), ""), visibility(request.visibility()), userId);
        return get(id, auth);
    }

    @GetMapping("/knowledge/{id}")
    public Map<String, Object> get(@PathVariable UUID id, org.springframework.security.core.Authentication auth) {
        Map<String, Object> page = db.queryForMap("SELECT id,organization_id,title,content,team_id,parent_id,visibility,created_by,created_at,updated_at FROM knowledge.pages WHERE id=? AND deleted_at IS NULL", id);
        member((UUID) page.get("organization_id"), auth);
        return page;
    }

    @PutMapping("/knowledge/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody UpdatePage request, org.springframework.security.core.Authentication auth) {
        get(id, auth);
        db.update("UPDATE knowledge.pages SET title=?,content=?,parent_id=?,visibility=?,updated_at=now() WHERE id=?", request.title().trim(), Objects.toString(request.content(), ""), request.parentId(), visibility(request.visibility()), id);
        return get(id, auth);
    }

    @DeleteMapping("/knowledge/{id}")
    public void delete(@PathVariable UUID id, org.springframework.security.core.Authentication auth) {
        get(id, auth);
        db.update("UPDATE knowledge.pages SET deleted_at=now(),updated_at=now() WHERE id=?", id);
    }

    private String visibility(String value) { return Set.of("PRIVATE", "ORG", "PUBLIC").contains(value) ? value : "ORG"; }
    private UUID user(org.springframework.security.core.Authentication auth) { return UUID.fromString(auth.getName()); }
    private void member(UUID orgId, org.springframework.security.core.Authentication auth) { if (db.queryForObject("SELECT count(*) FROM org.memberships WHERE organization_id=? AND user_id=?", Integer.class, orgId, user(auth)) == 0) throw new SecurityException("You do not have access to this workspace."); }
}
