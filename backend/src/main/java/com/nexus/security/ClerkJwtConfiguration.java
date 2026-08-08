package com.nexus.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;

@Configuration
class ClerkJwtConfiguration {
    @Bean
    @ConditionalOnProperty(name = "clerk.jwt-issuer")
    JwtDecoder clerkJwtDecoder(@Value("${clerk.jwt-issuer}") String issuer) {
        return JwtDecoders.fromIssuerLocation(issuer);
    }
}
