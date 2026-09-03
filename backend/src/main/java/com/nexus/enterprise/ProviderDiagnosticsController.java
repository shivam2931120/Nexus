package com.nexus.enterprise;

import com.nexus.org.OrganizationController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Safe, authenticated configuration diagnostics for the workspace settings UI.
 * This intentionally returns booleans and setup guidance only; secret values never
 * leave the server.
 */
@RestController
@RequestMapping("/api")
public class ProviderDiagnosticsController {
    private final JdbcTemplate db;
    private final OrganizationController organizations;
    private final String storageUrl;
    private final String storageKey;
    private final String storageBucket;
    private final String aiKey;
    private final String livekitUrl;
    private final String livekitKey;
    private final String livekitSecret;
    private final String googleClientId;
    private final String googleClientSecret;
    private final String googleRedirectUri;
    private final String smtpHost;
    private final String smtpUsername;
    private final String smtpPassword;
    private final String razorpayWebhookSecret;
    private final String clerkIssuer;
    private final String frontendOrigin;

    public ProviderDiagnosticsController(
            JdbcTemplate db,
            OrganizationController organizations,
            @Value("${SUPABASE_URL:}") String storageUrl,
            @Value("${SUPABASE_SECRET_KEY:}") String storageKey,
            @Value("${SUPABASE_STORAGE_BUCKET:nexus-files}") String storageBucket,
            @Value("${nexus.nemotron.api-key:}") String aiKey,
            @Value("${livekit.url:}") String livekitUrl,
            @Value("${livekit.api-key:}") String livekitKey,
            @Value("${livekit.api-secret:}") String livekitSecret,
            @Value("${GOOGLE_CLIENT_ID:}") String googleClientId,
            @Value("${GOOGLE_CLIENT_SECRET:}") String googleClientSecret,
            @Value("${GOOGLE_REDIRECT_URI:}") String googleRedirectUri,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword,
            @Value("${RAZORPAY_WEBHOOK_SECRET:}") String razorpayWebhookSecret,
            @Value("${CLERK_JWT_ISSUER:}") String clerkIssuer,
            @Value("${FRONTEND_ORIGIN:http://localhost:3000}") String frontendOrigin) {
        this.db = db;
        this.organizations = organizations;
        this.storageUrl = storageUrl;
        this.storageKey = storageKey;
        this.storageBucket = storageBucket;
        this.aiKey = aiKey;
        this.livekitUrl = livekitUrl;
        this.livekitKey = livekitKey;
        this.livekitSecret = livekitSecret;
        this.googleClientId = googleClientId;
        this.googleClientSecret = googleClientSecret;
        this.googleRedirectUri = googleRedirectUri;
        this.smtpHost = smtpHost;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
        this.razorpayWebhookSecret = razorpayWebhookSecret;
        this.clerkIssuer = clerkIssuer;
        this.frontendOrigin = frontendOrigin;
    }

    @GetMapping("/orgs/{orgId}/integrations/health")
    public Map<String, Object> health(@PathVariable UUID orgId,
                                      org.springframework.security.core.Authentication authentication) {
        organizations.requireMember(orgId, UUID.fromString(authentication.getName()));

        Map<String, Object> providers = new LinkedHashMap<>();
        providers.put("database", status(true, "The workspace database is reachable because this request was served."));
        providers.put("clerk", status(!blank(clerkIssuer), "Set CLERK_JWT_ISSUER on the backend."));
        providers.put("supabaseStorage", status(!blank(storageUrl) && !blank(storageKey) && !blank(storageBucket), "Set SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_STORAGE_BUCKET."));
        providers.put("nexusAI", status(!blank(aiKey), "Set NVIDIA_API_KEY or NEMOTRON_API_KEY on the backend."));
        providers.put("livekit", status(!blank(livekitUrl) && !blank(livekitKey) && !blank(livekitSecret), "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET."));
        providers.put("googleCalendar", status(!blank(googleClientId) && !blank(googleClientSecret) && !blank(googleRedirectUri), "Set Google OAuth credentials and use the exact production callback URL."));
        providers.put("smtp", status(!blank(smtpHost) && !blank(smtpUsername) && !blank(smtpPassword), "Set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD. Gmail requires an app password."));
        providers.put("razorpayWebhook", status(!blank(razorpayWebhookSecret), "Set RAZORPAY_WEBHOOK_SECRET only if payment webhooks are enabled."));
        providers.put("googleCalendarConnected", status(db.queryForObject("SELECT count(*) FROM integration.google_connections WHERE organization_id=?", Integer.class, orgId) > 0, "Connect Google Calendar from the Integrations page."));

        List<String> missing = new ArrayList<>();
        providers.forEach((name, value) -> {
            if (value instanceof Map<?, ?> item && Boolean.FALSE.equals(item.get("configured"))) missing.add(name);
        });
        return Map.of("providers", providers, "missing", missing, "frontendOrigin", frontendOrigin);
    }

    private static Map<String, Object> status(boolean configured, String guidance) {
        return Map.of("configured", configured, "guidance", guidance);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
