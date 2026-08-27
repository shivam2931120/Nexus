package com.nexus.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Configuration
class ClerkJwtConfiguration {
    private static final String DEFAULT_CLERK_PUBLIC_KEY = """
            -----BEGIN PUBLIC KEY-----
            MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAk/eS+gTYTdLmqNlLN5x+
            RN+4XKmztrVOxi8Fzzom1nU0M1igP1UfKfzeBRZA9o0wnbCUF/tbSmSAZtpTpNFz
            vOUC8Y5dBUcX9XD8WKJHb9PAIg68rcnz8XKs3fKOnBer0bTJHvxxYxtynotbGWVq
            PlVjEydXqucyyjAowbjb+5+Ds0AgjTXKuqXTgCxLuNZLBV+8Vnsqr1qFHX5Deb2c
            USWDvEM7ombyKbjHDTnJ3Al/JX+T65Qq9MVgF3SKapNRJa0VapblHbjfFhS0OFO+
            tH6jrRlckOYrxj0sYtHtOEUkEaAj9TABTjI219uzzsZNipMJCZgkMsLSfEp+g213
            YwIDAQAB
            -----END PUBLIC KEY-----
            """;

    @Bean
    JwtDecoder clerkJwtDecoder(
            @Value("${CLERK_JWT_ISSUER:}") String issuer,
            @Value("${CLERK_JWT_PUBLIC_KEY:}") String publicKeyPem) {
        if (issuer.isBlank()) {
            throw new IllegalStateException("CLERK_JWT_ISSUER must be configured.");
        }

        String normalizedIssuer = issuer.trim();
        try {
            String effectivePublicKey = publicKeyPem.isBlank() ? DEFAULT_CLERK_PUBLIC_KEY : publicKeyPem;
            String encoded = effectivePublicKey
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
