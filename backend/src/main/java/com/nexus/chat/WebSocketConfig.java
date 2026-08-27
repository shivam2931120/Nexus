package com.nexus.chat;

import com.nexus.auth.JwtService;
import com.nexus.security.ClerkIdentityService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final JwtStompInterceptor authentication;
    private final String frontendOrigin;

    public WebSocketConfig(JwtService jwt, JwtDecoder clerk, ClerkIdentityService identities,
                           JdbcTemplate db,
                           @Value("${FRONTEND_ORIGIN:http://localhost:3000}") String frontendOrigin) {
        this.authentication = new JwtStompInterceptor(jwt, clerk, identities, db);
        this.frontendOrigin = frontendOrigin;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authentication);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(
                "http://localhost:3000", "http://127.0.0.1:3000",
                "https://nexus.justshivamm.in", frontendOrigin, "https://*.vercel.app");
    }
}

final class JwtStompInterceptor implements ChannelInterceptor {
    private final JwtService localJwt;
    private final JwtDecoder clerk;
    private final ClerkIdentityService identities;
    private final JdbcTemplate db;

    JwtStompInterceptor(JwtService localJwt, JwtDecoder clerk, ClerkIdentityService identities, JdbcTemplate db) {
        this.localJwt = localJwt;
        this.clerk = clerk;
        this.identities = identities;
        this.db = db;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) throw new SecurityException("WebSocket authentication is required.");
            UUID userId = resolve(header.substring(7));
            accessor.setUser(new UsernamePasswordAuthenticationToken(
                    userId.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        }
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand())) {
            if (accessor.getUser() == null) throw new SecurityException("WebSocket authentication is required.");
            UUID channelId = channelId(accessor.getDestination());
            if (channelId != null && !canAccess(channelId, UUID.fromString(accessor.getUser().getName()))) {
                throw new SecurityException("You do not have access to this channel.");
            }
            UUID documentId = documentId(accessor.getDestination());
            if (documentId != null && !canAccessDocument(documentId, UUID.fromString(accessor.getUser().getName()))) {
                throw new SecurityException("You do not have access to this document.");
            }
        }
        return message;
    }

    private UUID resolve(String token) {
        try {
            return localJwt.parse(token);
        } catch (Exception ignored) {
            Jwt decoded = clerk.decode(token);
            String subject = decoded.getSubject();
            String email = Objects.toString(decoded.getClaimAsString("email"),
                    Objects.toString(decoded.getClaimAsString("email_address"), subject + "@clerk.local"));
            return identities.resolve(subject, email, displayName(decoded));
        }
    }

    private boolean canAccess(UUID channelId, UUID userId) {
        Integer count = db.queryForObject("""
                SELECT count(*) FROM chat.channels c
                WHERE c.id=? AND c.deleted_at IS NULL
                  AND EXISTS (SELECT 1 FROM org.memberships m WHERE m.organization_id=c.organization_id AND m.user_id=?)
                  AND (c.team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=c.team_id AND tm.user_id=?))
                  AND (c.type<>'PRIVATE' OR EXISTS (SELECT 1 FROM chat.channel_members cm WHERE cm.channel_id=c.id AND cm.user_id=?))
                """, Integer.class, channelId, userId, userId, userId);
        return count != null && count > 0;
    }

    private boolean canAccessDocument(UUID documentId, UUID userId) {
        Integer count = db.queryForObject("""
                SELECT count(*) FROM document.documents d
                WHERE d.id=? AND d.deleted_at IS NULL
                  AND EXISTS (SELECT 1 FROM org.memberships m WHERE m.organization_id=d.organization_id AND m.user_id=?)
                  AND (d.team_id IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=d.team_id AND tm.user_id=?))
                """, Integer.class, documentId, userId, userId);
        return count != null && count > 0;
    }

    private static String displayName(Jwt token) {
        String name = token.getClaimAsString("name");
        if (name != null && !name.isBlank()) return name;
        String full = (Objects.toString(token.getClaimAsString("first_name"), "") + " "
                + Objects.toString(token.getClaimAsString("last_name"), "")).trim();
        return full.isBlank() ? "Nexus user" : full;
    }

    private static UUID channelId(String destination) {
        if (destination == null) return null;
        String prefix = destination.startsWith("/topic/channel.") ? "/topic/channel."
                : destination.startsWith("/app/chat/") ? "/app/chat/" : null;
        if (prefix == null) return null;
        try {
            return UUID.fromString(destination.substring(prefix.length()));
        } catch (Exception exception) {
            throw new SecurityException("Invalid channel destination.");
        }
    }

    private static UUID documentId(String destination) {
        if (destination == null || !destination.startsWith("/topic/document.")) return null;
        String value = destination.substring("/topic/document.".length());
        int suffix = value.indexOf('.');
        if (suffix >= 0) value = value.substring(0, suffix);
        try {
            return UUID.fromString(value);
        } catch (Exception exception) {
            throw new SecurityException("Invalid document destination.");
        }
    }
}
