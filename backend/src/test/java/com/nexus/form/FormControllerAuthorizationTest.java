package com.nexus.form;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.org.OrganizationController;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class FormControllerAuthorizationTest {
    @Test
    void regularMemberCannotCreateOrganizationForm() {
        JdbcTemplate db = mock(JdbcTemplate.class);
        OrganizationController organizations = mock(OrganizationController.class);
        Authentication authentication = mock(Authentication.class);
        UUID user = UUID.randomUUID();
        UUID organization = UUID.randomUUID();

        when(authentication.getName()).thenReturn(user.toString());
        when(db.queryForObject(anyString(), eq(String.class), eq(organization), eq(user))).thenReturn("MEMBER");
        var controller = new FormController(db, organizations, new ObjectMapper());
        var request = new FormController.FormRequest("Leave request", "", "LEAVE", true, null, List.of());

        assertThatThrownBy(() -> controller.create(organization, request, authentication))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("Administrator");
        verify(db, never()).update(startsWith("INSERT INTO nexus_form.forms"), any(Object[].class));
    }
}
