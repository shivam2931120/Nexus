package com.nexus.work;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkControllerAuthorizationTest {
    @Test
    void rejectsProjectCreationForAnotherTeam() {
        JdbcTemplate db = mock(JdbcTemplate.class);
        Authentication auth = mock(Authentication.class);
        UUID user = UUID.randomUUID(), org = UUID.randomUUID(), team = UUID.randomUUID();
        when(auth.getName()).thenReturn(user.toString());
        when(db.queryForObject(startsWith("SELECT count(*) FROM org.memberships"), eq(Integer.class), any(), any())).thenReturn(1);
        when(db.queryForObject(startsWith("SELECT count(*) FROM org.teams"), eq(Integer.class), any(), any(), any())).thenReturn(0);

        var controller = new WorkController(db);

        assertThatThrownBy(() -> controller.project(org, new WorkController.CreateProject("Restricted", "", team), auth))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("team");
    }
}
