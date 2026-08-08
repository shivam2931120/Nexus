package com.nexus.integration;

import com.nexus.org.OrganizationController;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/integrations/google")
public class GoogleCalendarController {
    private final JdbcTemplate db; private final OrganizationController orgs; private final String clientId,clientSecret,redirectUri,frontendOrigin,jwtSecret;
    public GoogleCalendarController(JdbcTemplate db,OrganizationController orgs,@Value("${GOOGLE_CLIENT_ID:}") String clientId,@Value("${GOOGLE_CLIENT_SECRET:}") String clientSecret,@Value("${GOOGLE_REDIRECT_URI:}") String redirectUri,@Value("${FRONTEND_ORIGIN:http://localhost:3000}") String frontendOrigin,@Value("${JWT_SECRET:change-me-in-local-development-to-a-long-secret-key}") String jwtSecret){this.db=db;this.orgs=orgs;this.clientId=clientId;this.clientSecret=clientSecret;this.redirectUri=redirectUri;this.frontendOrigin=frontendOrigin;this.jwtSecret=jwtSecret;}
    @GetMapping("/start") public Map<String,String> start(@RequestParam UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);if(clientId.isBlank()||redirectUri.isBlank())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Google Calendar is not configured.");String state=Jwts.builder().claim("orgId",orgId.toString()).claim("userId",a.getName()).expiration(Date.from(Instant.now().plusSeconds(600))).signWith(key()).compact();String url="https://accounts.google.com/o/oauth2/v2/auth?client_id="+enc(clientId)+"&redirect_uri="+enc(redirectUri)+"&response_type=code&access_type=offline&prompt=consent&scope="+enc("https://www.googleapis.com/auth/calendar.events")+"&state="+enc(state);return Map.of("url",url);}
    @GetMapping("/callback") public org.springframework.http.ResponseEntity<Void> callback(@RequestParam String code,@RequestParam String state){var claims=Jwts.parser().verifyWith(key()).build().parseSignedClaims(state).getPayload();UUID orgId=UUID.fromString(claims.get("orgId",String.class));Map<?,?> token=RestClient.create().post().uri("https://oauth2.googleapis.com/token").contentType(MediaType.APPLICATION_FORM_URLENCODED).body("code="+enc(code)+"&client_id="+enc(clientId)+"&client_secret="+enc(clientSecret)+"&redirect_uri="+enc(redirectUri)+"&grant_type=authorization_code").retrieve().body(Map.class);if(token==null||token.get("access_token")==null)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,"Google token exchange failed.");String access=String.valueOf(token.get("access_token"));String refresh=token.get("refresh_token")==null?null:String.valueOf(token.get("refresh_token"));Number expires=token.get("expires_in") instanceof Number n?n:3600;db.update("INSERT INTO integration.google_connections(id,organization_id,access_token,refresh_token,expires_at) VALUES(?,?,?,?,now()+(? * interval '1 second')) ON CONFLICT(organization_id) DO UPDATE SET access_token=EXCLUDED.access_token,refresh_token=COALESCE(EXCLUDED.refresh_token,integration.google_connections.refresh_token),expires_at=EXCLUDED.expires_at,updated_at=now()",UUID.randomUUID(),orgId,access,refresh,expires.longValue());return org.springframework.http.ResponseEntity.status(302).header("Location",frontendOrigin+"/calendar?google=connected").build();}
    @GetMapping("/status") public Map<String,Boolean> status(@RequestParam UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);return Map.of("connected",db.queryForObject("SELECT count(*) FROM integration.google_connections WHERE organization_id=?",Integer.class,orgId)>0);}
    private void member(UUID id,org.springframework.security.core.Authentication a){orgs.requireMember(id,UUID.fromString(a.getName()));}
    private SecretKey key(){return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));}
    private static String enc(String s){return java.net.URLEncoder.encode(s,StandardCharsets.UTF_8);}
}
