package com.nexus.document;

import com.nexus.enterprise.InvitationMailService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentControllerAuthorizationTest {
    @Test
    void regularTeamMemberCannotDeleteAnotherMembersDocument() {
        JdbcTemplate db = mock(JdbcTemplate.class);
        InvitationMailService mail = mock(InvitationMailService.class);
        Authentication auth = mock(Authentication.class);
        UUID user = UUID.randomUUID();
        UUID creator = UUID.randomUUID();
        UUID org = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        Map<String, Object> document = new HashMap<>();
        document.put("id", documentId);
        document.put("organization_id", org);
        document.put("team_id", null);
        document.put("created_by", creator);
        document.put("version", 1);

        when(auth.getName()).thenReturn(user.toString());
        when(db.queryForMap(startsWith("SELECT * FROM document.documents"), eq(documentId))).thenReturn(document);
        when(db.queryForObject(startsWith("SELECT count(*) FROM org.memberships"), eq(Integer.class), eq(org), eq(user))).thenReturn(1);
        when(db.queryForObject(startsWith("SELECT role FROM org.memberships"), eq(String.class), eq(org), eq(user))).thenReturn("MEMBER");

        var controller = new DocumentController(db, mail);

        assertThatThrownBy(() -> controller.delete(documentId, auth))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("document owner");
        verify(db, never()).update(
                eq("UPDATE document.documents SET deleted_at=now(),updated_at=now() WHERE id=?"),
                eq(documentId));
    }
}
