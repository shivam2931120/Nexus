package com.nexus.chat;

import com.nexus.auth.JwtService; import org.springframework.beans.factory.annotation.Value; import org.springframework.context.annotation.Configuration; import org.springframework.messaging.simp.config.ChannelRegistration; import org.springframework.messaging.simp.config.MessageBrokerRegistry; import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
 private final JwtService jwt; private final String frontendOrigin; public WebSocketConfig(JwtService jwt,@Value("${FRONTEND_ORIGIN:http://localhost:3000}") String frontendOrigin){this.jwt=jwt;this.frontendOrigin=frontendOrigin;}
 public void configureMessageBroker(MessageBrokerRegistry r){r.enableSimpleBroker("/topic","/queue");r.setApplicationDestinationPrefixes("/app");r.setUserDestinationPrefix("/user");}
 public void configureClientInboundChannel(ChannelRegistration r){r.interceptors(new JwtStompInterceptor(jwt));}
 public void registerStompEndpoints(StompEndpointRegistry r){r.addEndpoint("/ws").setAllowedOriginPatterns("http://localhost:3000","http://127.0.0.1:3000",frontendOrigin,"https://*.vercel.app");}
}

final class JwtStompInterceptor implements org.springframework.messaging.support.ChannelInterceptor {
 private final JwtService jwt; JwtStompInterceptor(JwtService jwt){this.jwt=jwt;}
 public org.springframework.messaging.Message<?> preSend(org.springframework.messaging.Message<?> message,org.springframework.messaging.MessageChannel channel){var accessor=org.springframework.messaging.simp.stomp.StompHeaderAccessor.wrap(message);if(org.springframework.messaging.simp.stomp.StompCommand.CONNECT.equals(accessor.getCommand())){String header=accessor.getFirstNativeHeader("Authorization");if(header==null||!header.startsWith("Bearer "))throw new SecurityException("WebSocket authentication is required.");var id=jwt.parse(header.substring(7));accessor.setUser(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(id.toString(),null,java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"))));}return message;}
}
