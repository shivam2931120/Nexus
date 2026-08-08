package com.nexus.meeting;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/meetings")
public class MeetingController {
    private final String livekitUrl;
    private final String apiKey;
    private final String apiSecret;

    public MeetingController(
            @Value("${livekit.url:}") String livekitUrl,
            @Value("${livekit.api-key:}") String apiKey,
            @Value("${livekit.api-secret:}") String apiSecret) {
        this.livekitUrl = livekitUrl;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    public record TokenResponse(String serverUrl, String token, String room, String identity) {}

    @GetMapping("/token")
    public TokenResponse token(@RequestParam @NotBlank String room,
                               @RequestParam(required = false) String identity,
                               @RequestParam(required = false) String name,
                               org.springframework.security.core.Authentication authentication) {
        if (livekitUrl.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "LiveKit is not configured on the backend.");
        }
        String normalizedRoom = room.trim();
        if (!normalizedRoom.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,63}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid meeting room name.");
        }
        String participant = identity == null || identity.isBlank()
                ? authentication.getName()
                : identity.trim();
        if (!participant.matches("[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid participant identity.");
        }

        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8));
        Map<String, Object> videoGrant = Map.of(
                "room", normalizedRoom,
                "roomJoin", true,
                "canPublish", true,
                "canSubscribe", true,
                "canPublishData", true
        );
        var builder = Jwts.builder()
                .issuer(apiKey)
                .subject(participant)
                .issuedAt(Date.from(now))
                .notBefore(Date.from(now.minusSeconds(1)))
                .expiration(Date.from(now.plusSeconds(600)))
                .claim("video", videoGrant);
        if (name != null && !name.isBlank()) builder.claim("name", name.trim());
        return new TokenResponse(websocketUrl(livekitUrl), builder.signWith(key, SignatureAlgorithm.HS256).compact(), normalizedRoom, participant);
    }

    private static String websocketUrl(String value) {
        String url = value.trim();
        if (url.startsWith("https://")) return "wss://" + url.substring(8);
        if (url.startsWith("http://")) return "ws://" + url.substring(7);
        return url;
    }
}
