package com.nexus.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;

@Configuration
class ClerkJwtConfiguration {
    @Bean
    JwtDecoder clerkJwtDecoder(@Value("${CLERK_JWT_ISSUER:}") String issuer) {
        if (issuer.isBlank()) {
            throw new IllegalStateException("CLERK_JWT_ISSUER must be configured.");
        }
        return JwtDecoders.fromIssuerLocation(issuer.trim());
    }
}
