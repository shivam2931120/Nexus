package com.nexus.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
public class ProfileController {
    private final JdbcTemplate db;

    ProfileController(JdbcTemplate db) { this.db = db; }

    record ProfileUpdate(@NotBlank String name) {}

    @PutMapping("/profile")
    public Map<String, Object> update(@Valid @RequestBody ProfileUpdate update, org.springframework.security.core.Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        String name = update.name().trim();
        if (name.length() > 120) name = name.substring(0, 120);
        db.update("UPDATE nexus_auth.users SET name=?, updated_at=now() WHERE id=?", name, userId);
        return Map.of("name", name);
    }
}
