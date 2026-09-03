package com.nexus.security;

import com.nexus.auth.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, JwtFilter localJwtFilter, ClerkJwtFilter clerkJwtFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/api/public/forms/**", "/api/public/shared-files/**", "/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**", "/ws", "/ws/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> writeSecurityError(response, 401, "AUTHENTICATION_REQUIRED", "Sign in to continue."))
                        .accessDeniedHandler((request, response, exception) -> writeSecurityError(response, 403, "ACCESS_DENIED", "You do not have access to this resource.")))
                .addFilterBefore(localJwtFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(clerkJwtFilter, JwtFilter.class)
                .build();
    }

    private static void writeSecurityError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().printf("{\"code\":\"%s\",\"message\":\"%s\"}", code, message);
    }
}

@Component
class JwtFilter extends OncePerRequestFilter {
    private final JwtService jwt;

    JwtFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                try {
                    UUID userId = jwt.parse(header.substring(7));
                    authenticate(userId);
                } catch (Exception ignored) {
                    // The Clerk filter gets the same token next. Invalid tokens remain unauthenticated.
                }
            }
        }
        chain.doFilter(request, response);
    }

    static void authenticate(UUID userId) {
        var authentication = new UsernamePasswordAuthenticationToken(
                userId.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}

@Component
class ClerkJwtFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(ClerkJwtFilter.class);
    private final JwtDecoder decoder;
    private final ClerkIdentityService identities;

    ClerkJwtFilter(ObjectProvider<JwtDecoder> decoder, ClerkIdentityService identities) {
        this.decoder = decoder.getIfAvailable();
        this.identities = identities;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
            String header = request.getHeader("Authorization");
            if (decoder != null && header != null && header.startsWith("Bearer ")) {
                try {
                    Jwt token = decoder.decode(header.substring(7));
                    UUID userId = identities.resolve(token.getSubject(), email(token), displayName(token));
                    JwtFilter.authenticate(userId);
                } catch (Exception exception) {
                    log.warn("Clerk authentication failed for {} {}: {} - {}", request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName(), exception.getMessage());
                }
            }
        }
        chain.doFilter(request, response);
    }

    private static String email(Jwt token) {
        String email = claim(token, "email");
        if (email.isBlank()) email = claim(token, "email_address");
        return email.isBlank() ? token.getSubject() + "@clerk.local" : email;
    }

    private static String displayName(Jwt token) {
        String name = claim(token, "name");
        if (!name.isBlank()) return name;
        String full = (claim(token, "first_name") + " " + claim(token, "last_name")).trim();
        return full.isBlank() ? "Nexus user" : full;
    }

    private static String claim(Jwt token, String name) {
        String value = token.getClaimAsString(name);
        return value == null ? "" : value.trim();
    }
}
