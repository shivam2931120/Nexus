package com.nexus.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Configuration
class ClerkJwtConfiguration {
    @Bean
    JwtDecoder clerkJwtDecoder(
            @Value("${CLERK_JWT_ISSUER:}") String issuer,
            @Value("${CLERK_JWT_PUBLIC_KEY:}") String publicKeyPem) {
        if (issuer.isBlank()) {
            throw new IllegalStateException("CLERK_JWT_ISSUER must be configured.");
        }

        String normalizedIssuer = issuer.trim();
        if (publicKeyPem.isBlank()) {
            return JwtDecoders.fromIssuerLocation(normalizedIssuer);
        }

        try {
            String encoded = publicKeyPem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(encoded);
            RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(der));
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(publicKey).build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(normalizedIssuer));
            return decoder;
        } catch (Exception exception) {
            throw new IllegalStateException("CLERK_JWT_PUBLIC_KEY is not a valid RSA public key.", exception);
        }
    }
}
