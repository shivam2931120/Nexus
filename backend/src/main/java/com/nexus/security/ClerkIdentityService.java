package com.nexus.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class ClerkIdentityService {
    private final JdbcTemplate db;

    public ClerkIdentityService(JdbcTemplate db) {
        this.db = db;
    }

    public UUID resolve(String clerkId, String email, String displayName) {
        List<UUID> existing = db.query(
                "SELECT id FROM nexus_auth.users WHERE clerk_id=?",
                (result, row) -> result.getObject("id", UUID.class), clerkId);
        if (!existing.isEmpty()) return existing.get(0);

        return db.queryForObject("""
                INSERT INTO nexus_auth.users(id,email,password_hash,name,clerk_id)
                VALUES (?,?,?,?,?)
                ON CONFLICT (email) DO UPDATE SET
                    clerk_id=COALESCE(nexus_auth.users.clerk_id, EXCLUDED.clerk_id),
                    name=CASE WHEN nexus_auth.users.name IN ('Clerk user','Nexus user') THEN EXCLUDED.name ELSE nexus_auth.users.name END,
                    updated_at=now()
                RETURNING id
                """, UUID.class, UUID.randomUUID(), email, "{clerk}" + UUID.randomUUID(), displayName, clerkId);
    }
}
