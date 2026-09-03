package com.nexus.form;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.org.OrganizationController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api")
public class FormController {
    private static final Set<String> CATEGORIES = Set.of("LEAVE", "APPROVAL", "ONBOARDING", "SURVEY", "INCIDENT", "EQUIPMENT", "OTHER");
    private static final Set<String> FIELD_TYPES = Set.of("TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX", "EMAIL", "CALCULATED");
    private static final Set<String> FORM_STATUSES = Set.of("DRAFT", "PUBLISHED", "CLOSED");
    private final JdbcTemplate db;
    private final OrganizationController organizations;
    private final ObjectMapper json;

    public FormController(JdbcTemplate db, OrganizationController organizations, ObjectMapper json) {
        this.db = db;
        this.organizations = organizations;
        this.json = json;
    }

    public record FieldDefinition(String id, String label, String type, Boolean required, List<String> options, String placeholder, String conditionField, String conditionEquals, String formula) { public FieldDefinition(String id,String label,String type,Boolean required,List<String> options,String placeholder){this(id,label,type,required,options,placeholder,null,null,null);} }
    public record FormRequest(@NotBlank String title, String description, String category, Boolean approvalRequired, UUID teamId, List<FieldDefinition> fields) {}
    public record StatusRequest(@NotBlank String status) {}
    public record SubmissionRequest(Map<String, Object> responses) {}
    public record DecisionRequest(@NotBlank String decision, String note) {}

    @GetMapping("/orgs/{orgId}/forms")
    public List<Map<String, Object>> forms(@PathVariable UUID orgId, Authentication authentication) {
        UUID uid = user(authentication);
        member(orgId, uid);
        boolean manager = isAdmin(orgId, uid);
        return db.query("""
                SELECT f.*, f.fields::text fields_json, u.name creator_name,
                       (SELECT count(*) FROM nexus_form.submissions s WHERE s.form_id=f.id) submission_count
                FROM nexus_form.forms f JOIN nexus_auth.users u ON u.id=f.created_by
                WHERE f.organization_id=? AND f.deleted_at IS NULL
                  AND (f.status='PUBLISHED' OR f.created_by=? OR ?)
                  AND (f.team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=f.team_id AND tm.user_id=?) OR ?)
                ORDER BY CASE f.status WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END, f.updated_at DESC
                """, (rs, row) -> form(rs, manager), orgId, uid, manager, uid, manager);
    }

    @GetMapping("/forms/{id}")
    public Map<String, Object> form(@PathVariable UUID id, Authentication authentication) {
        Map<String, Object> access = formAccess(id, authentication);
        boolean manager = isAdmin((UUID) access.get("organization_id"), user(authentication));
        if (!manager && !"PUBLISHED".equals(access.get("status")) && !user(authentication).equals(access.get("created_by"))) {
            throw new SecurityException("This form is not available to employees yet.");
        }
        return db.queryForObject("SELECT f.*, f.fields::text fields_json, u.name creator_name, (SELECT count(*) FROM nexus_form.submissions s WHERE s.form_id=f.id) submission_count FROM nexus_form.forms f JOIN nexus_auth.users u ON u.id=f.created_by WHERE f.id=?", (rs, row) -> form(rs, manager), id);
    }

    @PostMapping("/orgs/{orgId}/forms")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@PathVariable UUID orgId, @Valid @RequestBody FormRequest request, Authentication authentication) {
        UUID uid = user(authentication);
        admin(orgId, uid);
        team(orgId, request.teamId());
        UUID id = UUID.randomUUID();
        List<FieldDefinition> fields = validatedFields(request.fields());
        db.update("INSERT INTO nexus_form.forms(id,organization_id,team_id,title,description,category,approval_required,fields,created_by) VALUES(?,?,?,?,?,?,?,?::jsonb,?)",
                id, orgId, request.teamId(), request.title().trim(), text(request.description()), category(request.category()), Boolean.TRUE.equals(request.approvalRequired()), write(fields), uid);
        audit(orgId, uid, "form.created", "form", id);
        return form(id, authentication);
    }

    @PutMapping("/forms/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody FormRequest request, Authentication authentication) {
        Map<String, Object> existing = formAccess(id, authentication);
        UUID orgId = (UUID) existing.get("organization_id");
        UUID uid = user(authentication);
        admin(orgId, uid);
        team(orgId, request.teamId());
        List<FieldDefinition> fields = validatedFields(request.fields());
        db.update("UPDATE nexus_form.forms SET team_id=?,title=?,description=?,category=?,approval_required=?,fields=?::jsonb,updated_at=now() WHERE id=? AND deleted_at IS NULL",
                request.teamId(), request.title().trim(), text(request.description()), category(request.category()), Boolean.TRUE.equals(request.approvalRequired()), write(fields), id);
        audit(orgId, uid, "form.updated", "form", id);
        return form(id, authentication);
    }

    @PatchMapping("/forms/{id}/status")
    public Map<String, Object> status(@PathVariable UUID id, @Valid @RequestBody StatusRequest request, Authentication authentication) {
        Map<String, Object> existing = formAccess(id, authentication);
        UUID orgId = (UUID) existing.get("organization_id");
        UUID uid = user(authentication);
        admin(orgId, uid);
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!FORM_STATUSES.contains(status)) throw new IllegalArgumentException("Unsupported form status.");
        if ("PUBLISHED".equals(status) && fields(existing).isEmpty()) throw new IllegalArgumentException("Add at least one field before publishing this form.");
        db.update("UPDATE nexus_form.forms SET status=?,updated_at=now() WHERE id=?", status, id);
        audit(orgId, uid, "form." + status.toLowerCase(Locale.ROOT), "form", id);
        return form(id, authentication);
    }

    @DeleteMapping("/forms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, Authentication authentication) {
        Map<String, Object> existing = formAccess(id, authentication);
        UUID orgId = (UUID) existing.get("organization_id");
        UUID uid = user(authentication);
        admin(orgId, uid);
        db.update("UPDATE nexus_form.forms SET deleted_at=now(),status='CLOSED',updated_at=now() WHERE id=?", id);
        audit(orgId, uid, "form.deleted", "form", id);
    }

    @PostMapping("/forms/{id}/submissions")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submit(@PathVariable UUID id, @RequestBody SubmissionRequest request, Authentication authentication) {
        Map<String, Object> form = formAccess(id, authentication);
        if (!"PUBLISHED".equals(form.get("status"))) throw new IllegalArgumentException("This form is not accepting responses.");
        UUID uid = user(authentication);
        Map<String, Object> responses = request.responses() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request.responses());
        applyCalculations(fields(form), responses); validateResponses(fields(form), responses);
        UUID submissionId = UUID.randomUUID();
        UUID orgId = (UUID) form.get("organization_id");
        String status = Boolean.TRUE.equals(form.get("approval_required")) ? "PENDING" : "SUBMITTED";
        db.update("INSERT INTO nexus_form.submissions(id,form_id,organization_id,submitted_by,responses,status) VALUES(?,?,?,?,?::jsonb,?)",
                submissionId, id, orgId, uid, write(responses), status);
        if ("PENDING".equals(status)) {
            List<UUID> reviewers = db.query("SELECT user_id FROM org.memberships WHERE organization_id=? AND role IN ('OWNER','ADMIN')", (rs, row) -> rs.getObject("user_id", UUID.class), orgId);
            for (UUID reviewer : reviewers) db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",
                    UUID.randomUUID(), orgId, reviewer, "FORM_APPROVAL", "Form approval requested", "A new response to " + form.get("title") + " needs review.");
        }
        audit(orgId, uid, "form.submitted", "form_submission", submissionId);
        return submission(submissionId, uid, isAdmin(orgId, uid));
    }

    @GetMapping("/orgs/{orgId}/form-submissions")
    public List<Map<String, Object>> submissions(@PathVariable UUID orgId, @RequestParam(required = false) UUID formId, Authentication authentication) {
        UUID uid = user(authentication);
        member(orgId, uid);
        boolean manager = isAdmin(orgId, uid);
        String sql = """
                SELECT s.*, s.responses::text responses_json, f.title form_title, f.category, f.approval_required,
                       COALESCE(u.name,s.submitter_label,'Anonymous') submitter_name, u.email submitter_email, reviewer.name reviewer_name
                FROM nexus_form.submissions s
                JOIN nexus_form.forms f ON f.id=s.form_id
                LEFT JOIN nexus_auth.users u ON u.id=s.submitted_by
                LEFT JOIN nexus_auth.users reviewer ON reviewer.id=s.reviewed_by
                WHERE s.organization_id=? AND (? OR s.submitted_by=?) AND (?::uuid IS NULL OR s.form_id=?::uuid)
                ORDER BY s.submitted_at DESC
                """;
        return db.query(sql, (rs, row) -> submission(rs, manager), orgId, manager, uid, formId, formId);
    }

    @PatchMapping("/form-submissions/{id}/decision")
    public Map<String, Object> decide(@PathVariable UUID id, @Valid @RequestBody DecisionRequest request, Authentication authentication) {
        Map<String, Object> current = db.queryForMap("SELECT id,organization_id,submitted_by,status FROM nexus_form.submissions WHERE id=?", id);
        UUID orgId = (UUID) current.get("organization_id");
        UUID uid = user(authentication);
        admin(orgId, uid);
        String decision = request.decision().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(decision)) throw new IllegalArgumentException("Decision must be APPROVED or REJECTED.");
        if (!Set.of("PENDING", "SUBMITTED").contains(String.valueOf(current.get("status")))) throw new IllegalArgumentException("This submission has already been reviewed.");
        db.update("UPDATE nexus_form.submissions SET status=?,reviewed_by=?,review_note=?,reviewed_at=now(),updated_at=now() WHERE id=?", decision, uid, text(request.note()), id);
        db.update("INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body) VALUES(?,?,?,?,?,?)",
                UUID.randomUUID(), orgId, current.get("submitted_by"), "FORM_DECISION", "Form response " + decision.toLowerCase(Locale.ROOT), text(request.note()).isBlank() ? "Your form response was " + decision.toLowerCase(Locale.ROOT) + "." : text(request.note()));
        audit(orgId, uid, "form_submission." + decision.toLowerCase(Locale.ROOT), "form_submission", id);
        return submission(id, uid, true);
    }

    private Map<String, Object> formAccess(UUID id, Authentication authentication) {
        Map<String, Object> form = db.queryForMap("SELECT f.*,f.fields::text fields_json FROM nexus_form.forms f WHERE f.id=? AND f.deleted_at IS NULL", id);
        UUID uid = user(authentication);
        UUID orgId = (UUID) form.get("organization_id");
        member(orgId, uid);
        UUID teamId = (UUID) form.get("team_id");
        if (teamId != null && !isAdmin(orgId, uid) && db.queryForObject("SELECT count(*) FROM org.team_members WHERE team_id=? AND user_id=?", Integer.class, teamId, uid) == 0) {
            throw new SecurityException("You do not have access to this team form.");
        }
        return form;
    }

    private Map<String, Object> submission(UUID id, UUID uid, boolean manager) {
        return db.queryForObject("SELECT s.*,s.responses::text responses_json,f.title form_title,f.category,f.approval_required,COALESCE(u.name,s.submitter_label,'Anonymous') submitter_name,u.email submitter_email,reviewer.name reviewer_name FROM nexus_form.submissions s JOIN nexus_form.forms f ON f.id=s.form_id LEFT JOIN nexus_auth.users u ON u.id=s.submitted_by LEFT JOIN nexus_auth.users reviewer ON reviewer.id=s.reviewed_by WHERE s.id=? AND (? OR s.submitted_by=?)", (rs, row) -> submission(rs, manager), id, manager, uid);
    }

    private Map<String, Object> form(ResultSet rs, boolean manager) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", rs.getObject("id", UUID.class));
        item.put("organization_id", rs.getObject("organization_id", UUID.class));
        item.put("team_id", rs.getObject("team_id", UUID.class));
        item.put("title", rs.getString("title"));
        item.put("description", rs.getString("description"));
        item.put("category", rs.getString("category"));
        item.put("status", rs.getString("status"));
        item.put("approval_required", rs.getBoolean("approval_required"));
        item.put("anonymous_enabled", rs.getBoolean("anonymous_enabled"));
        item.put("public_slug", rs.getString("public_slug"));
        item.put("fields", readList(rs.getString("fields_json")));
        item.put("created_by", rs.getObject("created_by", UUID.class));
        item.put("creator_name", rs.getString("creator_name"));
        item.put("created_at", rs.getObject("created_at"));
        item.put("updated_at", rs.getObject("updated_at"));
        item.put("submission_count", rs.getLong("submission_count"));
        item.put("can_manage", manager);
        return item;
    }

    private Map<String, Object> submission(ResultSet rs, boolean manager) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", rs.getObject("id", UUID.class));
        item.put("form_id", rs.getObject("form_id", UUID.class));
        item.put("form_title", rs.getString("form_title"));
        item.put("category", rs.getString("category"));
        item.put("approval_required", rs.getBoolean("approval_required"));
        item.put("submitted_by", rs.getObject("submitted_by", UUID.class));
        item.put("submitter_name", rs.getString("submitter_name"));
        item.put("submitter_email", rs.getString("submitter_email"));
        item.put("responses", readMap(rs.getString("responses_json")));
        item.put("status", rs.getString("status"));
        item.put("review_note", rs.getString("review_note"));
        item.put("reviewer_name", rs.getString("reviewer_name"));
        item.put("submitted_at", rs.getObject("submitted_at"));
        item.put("reviewed_at", rs.getObject("reviewed_at"));
        item.put("can_review", manager);
        return item;
    }

    private List<FieldDefinition> validatedFields(List<FieldDefinition> requested) {
        if (requested == null) return List.of();
        if (requested.size() > 50) throw new IllegalArgumentException("A form can contain at most 50 fields.");
        Set<String> ids = new HashSet<>();
        List<FieldDefinition> fields = new ArrayList<>();
        for (FieldDefinition field : requested) {
            if (field == null || field.label() == null || field.label().isBlank()) throw new IllegalArgumentException("Every form field needs a label.");
            String type = field.type() == null ? "TEXT" : field.type().trim().toUpperCase(Locale.ROOT);
            if (!FIELD_TYPES.contains(type)) throw new IllegalArgumentException("Unsupported form field type.");
            String id = field.id() == null || field.id().isBlank() ? "field_" + UUID.randomUUID().toString().substring(0, 8) : field.id().replaceAll("[^A-Za-z0-9_-]", "_");
            if (!ids.add(id)) throw new IllegalArgumentException("Form field identifiers must be unique.");
            List<String> options = field.options() == null ? List.of() : field.options().stream().filter(Objects::nonNull).map(String::trim).filter(value -> !value.isBlank()).distinct().limit(30).toList();
            if (Set.of("SELECT", "RADIO").contains(type) && options.isEmpty()) throw new IllegalArgumentException(field.label() + " needs at least one option.");
            fields.add(new FieldDefinition(id, field.label().trim(), type, Boolean.TRUE.equals(field.required()), options, text(field.placeholder()),text(field.conditionField()),text(field.conditionEquals()),text(field.formula())));
        }
        return fields;
    }

    private void validateResponses(List<Map<String, Object>> fields, Map<String, Object> responses) {
        Set<String> allowed = new HashSet<>();
        for (Map<String, Object> field : fields) {
            String id = String.valueOf(field.get("id"));
            allowed.add(id);
            String condition=Objects.toString(field.get("conditionField"),""); if(!condition.isBlank()&&!Objects.equals(Objects.toString(responses.get(condition),""),Objects.toString(field.get("conditionEquals"),"")))continue;
            Object value = responses.get(id);
            if (Boolean.TRUE.equals(field.get("required")) && (value == null || String.valueOf(value).isBlank())) throw new IllegalArgumentException(field.get("label") + " is required.");
        }
        if (!allowed.containsAll(responses.keySet())) throw new IllegalArgumentException("The response contains fields that do not belong to this form.");
    }
    private void applyCalculations(List<Map<String,Object>> fields,Map<String,Object> responses){for(Map<String,Object> field:fields){if(!"CALCULATED".equals(field.get("type")))continue;String formula=Objects.toString(field.get("formula"),"").replaceAll("[^A-Za-z0-9_+\\-*/(). ]","");double total=0;boolean first=true;for(String part:formula.split("\\+")){double value;try{value=Double.parseDouble(part.trim());}catch(Exception ignored){Object raw=responses.get(part.trim());try{value=Double.parseDouble(Objects.toString(raw,"0"));}catch(Exception e){value=0;}}total=first?value:total+value;first=false;}responses.put(String.valueOf(field.get("id")),total);}}

    private List<Map<String, Object>> fields(Map<String, Object> form) { return readList(String.valueOf(form.get("fields_json"))); }
    private List<Map<String, Object>> readList(String value) { try { return json.readValue(value, new TypeReference<>() {}); } catch (JsonProcessingException e) { throw new IllegalStateException("Stored form fields are invalid.", e); } }
    private Map<String, Object> readMap(String value) { try { return json.readValue(value, new TypeReference<>() {}); } catch (JsonProcessingException e) { throw new IllegalStateException("Stored form responses are invalid.", e); } }
    private String write(Object value) { try { return json.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalArgumentException("Form data could not be encoded."); } }
    private String category(String value) { String category = value == null ? "OTHER" : value.trim().toUpperCase(Locale.ROOT); if (!CATEGORIES.contains(category)) throw new IllegalArgumentException("Unsupported form category."); return category; }
    private String text(String value) { return value == null ? "" : value.trim(); }
    private UUID user(Authentication authentication) { return UUID.fromString(authentication.getName()); }
    private void member(UUID orgId, UUID uid) { organizations.requireMember(orgId, uid); }
    private void admin(UUID orgId, UUID uid) { member(orgId, uid); if (!isAdmin(orgId, uid)) throw new SecurityException("Administrator access is required to manage forms."); }
    private boolean isAdmin(UUID orgId, UUID uid) { String role = db.queryForObject("SELECT role FROM org.memberships WHERE organization_id=? AND user_id=?", String.class, orgId, uid); return Set.of("OWNER", "ADMIN").contains(role); }
    private void team(UUID orgId, UUID teamId) { if (teamId != null && db.queryForObject("SELECT count(*) FROM org.teams WHERE id=? AND organization_id=? AND deleted_at IS NULL", Integer.class, teamId, orgId) == 0) throw new IllegalArgumentException("The selected team does not belong to this organization."); }
    private void audit(UUID orgId, UUID actor, String action, String type, UUID id) { db.update("INSERT INTO audit.events(id,organization_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)", UUID.randomUUID(), orgId, actor, action, type, id); }
}
