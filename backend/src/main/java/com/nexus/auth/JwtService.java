package com.nexus.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key; private final String issuer; private final long minutes;
    public JwtService(@Value("${nexus.jwt.secret}") String secret,@Value("${nexus.jwt.issuer}") String issuer,@Value("${nexus.jwt.access-minutes}") long minutes){this.key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));this.issuer=issuer;this.minutes=minutes;}
    public String accessToken(User user){var now=Instant.now();return Jwts.builder().subject(user.getId().toString()).issuer(issuer).audience().add("nexus-api").and().claim("email",user.getEmail()).claim("name",user.getName()).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(minutes*60))).signWith(key).compact();}
    public UUID parse(String token){var p=Jwts.parser().verifyWith(key).requireIssuer(issuer).requireAudience("nexus-api").build().parseSignedClaims(token);return UUID.fromString(p.getPayload().getSubject());}
}
