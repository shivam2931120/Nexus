# Technical Requirements Document (TRD)

**Product:** TeamOS (Nexus)
**Version:** 1.0
**Date:** August 2026
**Author:** Shivam
**Status:** Draft

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Microservices Breakdown](#3-microservices-breakdown)
4. [Database Design](#4-database-design)
5. [Real-Time System](#5-real-time-system)
6. [Authentication & Security](#6-authentication--security)
7. [File Storage (Cloudflare R2)](#7-file-storage-cloudflare-r2)
8. [Search (PostgreSQL FTS)](#8-search-postgresql-fts)
9. [Async Messaging (PostgreSQL LISTEN/NOTIFY)](#9-async-messaging-postgresql-listennotify)
10. [API Design](#10-api-design)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Infrastructure & DevOps](#12-infrastructure--devops)
13. [Service Communication](#13-service-communication)
14. [MVP Build Order](#14-mvp-build-order)

---

## 1. System Architecture

TeamOS follows a **microservices architecture** with a central API Gateway. All client traffic flows through the gateway, which handles routing, authentication verification, and rate limiting.

```
┌─────────────────────────────────────────────┐
│              Client (Next.js)               │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────┐
│          Spring Cloud Gateway               │
│   (Auth filter, Rate limiting, Routing)     │
└──┬────────┬────────┬────────┬───────────────┘
   │        │        │        │
   ▼        ▼        ▼        ▼
Auth    User/Org  Chat    Project
Service  Service  Service  Service
   │        │        │        │
   ▼        ▼        ▼        ▼
Doc     File    Notif   Meeting
Service Service Service Service
   │        │        │        │
   ▼        ▼        ▼        ▼
Calendar Analytics Approval Search
Service  Service   Service  Service
   │
   ▼
Billing
Service

All services → PostgreSQL (per-service schema or DB)
Chat Service → Redis (presence, pub/sub)
File Service → Cloudflare R2
Notifications → PostgreSQL LISTEN/NOTIFY
Search → PostgreSQL Full-Text Search
```

---

## 2. Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | Java | 21 (LTS) | Virtual threads (Project Loom) for concurrency |
| Framework | Spring Boot | 3.3.x | Core application framework |
| API Gateway | Spring Cloud Gateway | 4.x | Routing, auth filter, rate limiting |
| Security | Spring Security | 6.x | JWT, OAuth2, method-level security |
| ORM | Spring Data JPA + Hibernate | 6.x | DB access layer |
| WebSocket | Spring WebSocket + STOMP | | Real-time chat, notifications |
| Scheduling | Spring Scheduler / Batch | | Digest emails, cleanup jobs |
| Validation | Jakarta Bean Validation | | Request validation |
| Caching | Spring Cache + Redis | | Session cache, presence data |
| HTTP Client | WebClient (reactive) | | Service-to-service calls |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15 | SSR, routing, performance |
| UI Library | React | 19 | Component model |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Components | shadcn/ui | Latest | Pre-built accessible components |
| State | Zustand | 4.x | Global client state |
| Server State | TanStack Query | 5.x | API data fetching, caching |
| WebSocket | STOMP.js + SockJS | | Real-time client connection |
| Rich Text Editor | Tiptap | 2.x | Documents, collaborative editing |
| Charts | Recharts | | Analytics dashboards |
| Whiteboard | Excalidraw (embedded) | | Whiteboard feature |

### Infrastructure

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | PostgreSQL 16 | Primary data store for all services |
| Cache | Redis 7 | Session storage, presence, pub/sub |
| File Storage | Cloudflare R2 | File uploads (S3-compatible) |
| Containerization | Docker + Docker Compose | Local dev and deployment |
| Orchestration | Docker Compose (dev) / K8s (prod) | Service management |
| Reverse Proxy | NGINX | SSL termination, load balancing |
| CI/CD | GitHub Actions | Build, test, deploy pipeline |
| Monitoring | Prometheus + Grafana | Metrics and dashboards |
| Logging | Loki + Grafana | Log aggregation |
| Tracing | Jaeger | Distributed tracing |

---

## 3. Microservices Breakdown

### 3.1 Auth Service
**Port:** 8081
**Responsibilities:**
- User registration and login (email/password + OAuth)
- JWT generation (access token: 15min, refresh token: 7 days)
- 2FA (TOTP via Google Authenticator)
- Password reset flow
- Device/session management
- Token revocation (store revoked JTIs in Redis)

**Key Endpoints:**
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/2fa/enable
POST /auth/2fa/verify
GET  /auth/sessions
DELETE /auth/sessions/{sessionId}
```

**Database Schema (auth_db):**
```sql
users (id, email, password_hash, name, avatar_url, created_at, is_verified)
oauth_providers (id, user_id, provider, provider_user_id)
refresh_tokens (id, user_id, token_hash, device_info, expires_at, revoked)
totp_secrets (user_id, secret, enabled)
password_reset_tokens (id, user_id, token_hash, expires_at, used)
```

---

### 3.2 Organization Service
**Port:** 8082
**Responsibilities:**
- Create and manage organizations
- Invite members via email link
- Manage departments, teams
- Role and permission management
- Employee profiles and directory
- Org chart

**Key Endpoints:**
```
POST   /orgs
GET    /orgs/{orgId}
PUT    /orgs/{orgId}
POST   /orgs/{orgId}/invite
GET    /orgs/{orgId}/members
PUT    /orgs/{orgId}/members/{userId}/role
POST   /orgs/{orgId}/teams
GET    /orgs/{orgId}/teams
POST   /orgs/{orgId}/departments
GET    /orgs/{orgId}/directory
```

**Database Schema (org_db):**
```sql
organizations (id, name, slug, logo_url, plan, created_at)
org_members (org_id, user_id, role, joined_at)
departments (id, org_id, name, head_user_id)
teams (id, org_id, department_id, name, description, avatar_url)
team_members (team_id, user_id, role)
invitations (id, org_id, email, role, token, expires_at, accepted)
employee_profiles (user_id, org_id, title, bio, skills[], manager_id, location)
```

---

### 3.3 Chat Service
**Port:** 8083
**Responsibilities:**
- Channel management (public/private)
- Direct messages (1:1 and group)
- Real-time message delivery via WebSocket (STOMP)
- Message reactions, threads, pins
- Typing indicators via Redis
- Presence (online/offline/away) via Redis
- Message search via PostgreSQL FTS
- File sharing in chat (pre-signed R2 URLs)

**Key Endpoints:**
```
POST   /channels
GET    /channels/{teamId}
POST   /channels/{channelId}/messages
GET    /channels/{channelId}/messages (paginated)
PUT    /messages/{messageId}
DELETE /messages/{messageId}
POST   /messages/{messageId}/reactions
POST   /messages/{messageId}/pin
GET    /dms/{userId}
POST   /dms/{userId}/messages
GET    /search/messages?q=&orgId=
```

**WebSocket Topics (STOMP):**
```
/topic/channel.{channelId}        → new messages
/topic/channel.{channelId}.typing → typing indicators
/topic/dm.{userId}                → direct messages
/user/queue/notifications         → personal notifications
```

**Database Schema (chat_db):**
```sql
channels (id, team_id, name, type[public/private/announcement], created_by)
channel_members (channel_id, user_id, last_read_at)
messages (id, channel_id, sender_id, content, content_tsv, type, parent_id, edited_at, deleted_at, created_at)
message_reactions (message_id, user_id, emoji)
pinned_messages (channel_id, message_id, pinned_by)
dm_conversations (id, org_id)
dm_participants (conversation_id, user_id)
scheduled_messages (id, channel_id, sender_id, content, scheduled_at, sent)

-- FTS index
CREATE INDEX messages_fts_idx ON messages USING GIN(content_tsv);
```

---

### 3.4 Project Service
**Port:** 8084
**Responsibilities:**
- Project CRUD
- Sprint management
- Epic → Story → Task → Subtask hierarchy
- Task assignment, labels, priority, status
- Time tracking
- Dependencies
- Burndown and velocity data

**Key Endpoints:**
```
POST   /projects
GET    /projects/{projectId}
POST   /projects/{projectId}/sprints
GET    /projects/{projectId}/backlog
POST   /tasks
GET    /tasks/{taskId}
PUT    /tasks/{taskId}
DELETE /tasks/{taskId}
POST   /tasks/{taskId}/comments
POST   /tasks/{taskId}/time-log
GET    /projects/{projectId}/burndown
GET    /projects/{projectId}/velocity
```

**Database Schema (project_db):**
```sql
projects (id, team_id, name, description, status, start_date, end_date)
sprints (id, project_id, name, goal, start_date, end_date, status)
epics (id, project_id, title, description, color, status)
tasks (id, project_id, sprint_id, epic_id, parent_task_id, title, description,
       type, status, priority, assignee_id, reporter_id, due_date,
       story_points, created_at, updated_at, content_tsv)
task_labels (task_id, label)
task_dependencies (task_id, depends_on_task_id, type[blocks/is_blocked_by])
task_comments (id, task_id, user_id, content, created_at)
task_attachments (id, task_id, file_key, file_name, file_size)
time_logs (id, task_id, user_id, hours, logged_at, description)

CREATE INDEX tasks_fts_idx ON tasks USING GIN(content_tsv);
```

---

### 3.5 Document Service
**Port:** 8085
**Responsibilities:**
- Document CRUD (stored as JSON/ProseMirror state)
- Folder organization
- Real-time collaborative editing (CRDT via Yjs + Hocuspocus server, or OT)
- Version history (snapshot on save)
- Comments on text selections
- Templates
- Full-text search
- PDF export (using iText or Apache PDFBox)

**Key Endpoints:**
```
POST   /docs
GET    /docs/{docId}
PUT    /docs/{docId}
DELETE /docs/{docId}
GET    /docs/{docId}/history
POST   /docs/{docId}/restore/{versionId}
POST   /docs/{docId}/comments
GET    /docs/{docId}/comments
GET    /folders/{teamId}
POST   /folders
GET    /search/docs?q=&orgId=
GET    /docs/{docId}/export/pdf
```

**Database Schema (doc_db):**
```sql
folders (id, team_id, parent_folder_id, name, created_by)
documents (id, folder_id, title, content_json, content_tsv, created_by, updated_by, created_at, updated_at)
doc_permissions (doc_id, user_id, permission[view/edit/comment])
doc_versions (id, doc_id, content_json, saved_by, saved_at)
doc_comments (id, doc_id, user_id, content, selection_from, selection_to, resolved, created_at)

CREATE INDEX docs_fts_idx ON documents USING GIN(content_tsv);
```

---

### 3.6 File Service
**Port:** 8086
**Responsibilities:**
- Generate pre-signed upload/download URLs (Cloudflare R2)
- Track file metadata in PostgreSQL
- Folder structure and permissions
- File versioning
- Recycle bin
- Storage quota enforcement

**Key Endpoints:**
```
POST   /files/upload-url     → returns pre-signed R2 URL
POST   /files/confirm        → called after client uploads to R2
GET    /files/{fileId}
DELETE /files/{fileId}
GET    /files/{fileId}/versions
POST   /folders
GET    /folders/{teamId}
GET    /files/trash
POST   /files/{fileId}/restore
```

**Cloudflare R2 Integration:**
```java
// Use AWS SDK v2 (R2 is S3-compatible)
S3Client r2Client = S3Client.builder()
    .endpointOverride(URI.create("https://<account>.r2.cloudflarestorage.com"))
    .credentialsProvider(StaticCredentialsProvider.create(
        AwsBasicCredentials.create(R2_ACCESS_KEY, R2_SECRET_KEY)))
    .region(Region.of("auto"))
    .build();

// Generate pre-signed upload URL (valid 15 min)
PresignedPutObjectRequest presigned = presigner.presignPutObject(r -> r
    .signatureDuration(Duration.ofMinutes(15))
    .putObjectRequest(p -> p.bucket(BUCKET).key(fileKey)));
```

**Database Schema (file_db):**
```sql
file_folders (id, team_id, parent_id, name, created_by)
files (id, folder_id, name, r2_key, content_type, size_bytes, version, uploaded_by, deleted_at)
file_versions (id, file_id, r2_key, size_bytes, uploaded_by, created_at)
file_permissions (file_id, user_id, permission)
storage_usage (org_id, bytes_used, updated_at)
```

---

### 3.7 Notification Service
**Port:** 8087
**Responsibilities:**
- Receive notification events via PostgreSQL LISTEN/NOTIFY
- Deliver real-time notifications via WebSocket (STOMP)
- Send email notifications (via JavaMailSender + SMTP)
- Store notification history
- Respect user preferences (DND, digest settings)

**PostgreSQL LISTEN/NOTIFY Flow:**
```
Any service → NOTIFY 'notifications_channel', '{json payload}'
                    ↓
Notification Service LISTEN on 'notifications_channel'
                    ↓
Parse event → check user preferences → push via WebSocket
                    ↓
If email enabled → send via SMTP (async)
```

**Notification Event Payload:**
```json
{
  "type": "TASK_ASSIGNED",
  "recipientUserId": "uuid",
  "orgId": "uuid",
  "title": "New task assigned to you",
  "body": "Shivam assigned 'Fix login bug' to you",
  "link": "/projects/123/tasks/456",
  "metadata": {}
}
```

**Triggering from any service:**
```java
// Spring component in any service
@Component
public class NotificationPublisher {
    @Autowired private JdbcTemplate jdbcTemplate;

    public void publish(NotificationEvent event) {
        String payload = objectMapper.writeValueAsString(event);
        jdbcTemplate.execute("NOTIFY notifications_channel, '" + payload + "'");
    }
}
```

**Database Schema (notif_db):**
```sql
notifications (id, recipient_user_id, org_id, type, title, body, link, read, created_at)
notification_preferences (user_id, type, in_app, email, push, digest_only)
```

---

### 3.8 Calendar Service
**Port:** 8088

**Database Schema (calendar_db):**
```sql
events (id, org_id, title, description, start_time, end_time, type, created_by, recurrence_rule)
event_attendees (event_id, user_id, status[accepted/declined/pending])
```

---

### 3.9 Meeting Service
**Port:** 8089
**Responsibilities:**
- Schedule meetings, generate join links
- Integrate with LiveKit for WebRTC
- Store recordings reference (file stored on R2)
- Meeting notes and attendance

**Database Schema (meeting_db):**
```sql
meetings (id, org_id, team_id, title, scheduled_at, duration_min, livekit_room_id, recording_file_key)
meeting_participants (meeting_id, user_id, joined_at, left_at)
meeting_notes (id, meeting_id, content_json, created_by)
```

---

### 3.10 Analytics Service
**Port:** 8090
**Responsibilities:**
- Aggregate data from other services
- Generate charts data (tasks completed, velocity, etc.)
- Runs as scheduled Spring Batch jobs nightly

---

### 3.11 Billing Service
**Port:** 8091
**Responsibilities:**
- Track organization plan
- Integrate with Stripe for payments
- Enforce feature gates based on plan
- Usage metering (storage, seats)

---

### 3.12 Search Service
**Port:** 8092
**Responsibilities:**
- Unified search API across messages, docs, tasks, files
- Delegates to PostgreSQL FTS on each respective DB
- Aggregates and ranks results

**Unified Search Query:**
```sql
-- Messages
SELECT id, 'message' as type, content, channel_id, created_at,
       ts_rank(content_tsv, query) AS rank
FROM messages, to_tsquery('english', $1) query
WHERE content_tsv @@ query AND org_id = $2

UNION ALL

-- Documents
SELECT id, 'document' as type, title, folder_id, updated_at,
       ts_rank(content_tsv, query) AS rank
FROM documents, to_tsquery('english', $1) query
WHERE content_tsv @@ query AND org_id = $2

UNION ALL

-- Tasks
SELECT id, 'task' as type, title, project_id, updated_at,
       ts_rank(content_tsv, query) AS rank
FROM tasks, to_tsquery('english', $1) query
WHERE content_tsv @@ query AND org_id = $2

ORDER BY rank DESC LIMIT 20;
```

---

## 4. Database Design

### Strategy: Schema-per-service
Each microservice owns its schema within the same PostgreSQL instance (for MVP). In production, they can be separated into distinct databases.

```
PostgreSQL Instance
├── schema: auth
├── schema: org
├── schema: chat
├── schema: project
├── schema: document
├── schema: file
├── schema: notification
├── schema: calendar
├── schema: meeting
├── schema: billing
```

### Key Design Patterns

**Soft Deletes:** All major entities use `deleted_at` timestamp instead of hard deletes.

**Audit Fields:** All tables include `created_at`, `updated_at`, `created_by` (user_id).

**UUID Primary Keys:** All services use UUID v7 (time-ordered) for IDs to avoid enumeration.

**FTS Triggers:** Auto-update `content_tsv` columns via PostgreSQL triggers:
```sql
CREATE OR REPLACE FUNCTION update_fts_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv = to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_fts_trigger
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_fts_vector();
```

---

## 5. Real-Time System

### Architecture

```
Client (STOMP.js) ←→ Spring WebSocket (STOMP broker) ←→ Services
                                  ↑
                             Redis Pub/Sub
                         (presence, cross-node sync)
```

### WebSocket Connection Flow
```
1. Client connects to /ws endpoint
2. Client sends STOMP CONNECT with JWT in headers
3. Gateway validates JWT, allows connection
4. Client subscribes to topics:
   - /topic/channel.{channelId}
   - /user/queue/notifications
   - /topic/org.{orgId}.presence
5. Server delivers messages as STOMP MESSAGE frames
```

### Presence System (Redis)
```java
// Mark user online
redisTemplate.opsForValue().set("presence:" + userId, "online", 30, TimeUnit.SECONDS);

// Heartbeat every 20s from client keeps it alive
// On WebSocket disconnect → key expires → user goes offline

// Publish presence change
redisTemplate.convertAndSend("presence", userId + ":offline");
```

### Typing Indicators
```java
// Client sends typing event
@MessageMapping("/chat/{channelId}/typing")
public void handleTyping(@DestinationVariable String channelId,
                         Principal principal) {
    messagingTemplate.convertAndSend(
        "/topic/channel." + channelId + ".typing",
        new TypingEvent(principal.getName(), System.currentTimeMillis())
    );
}
// Client removes typing indicator after 3s of no events
```

---

## 6. Authentication & Security

### JWT Flow
```
Login → Auth Service issues:
  access_token (JWT, 15 min, signed with RS256 private key)
  refresh_token (opaque, 7 days, stored hashed in DB)

Client stores:
  access_token → memory (not localStorage)
  refresh_token → httpOnly cookie

API Gateway:
  Validates access_token signature with RS256 public key
  No DB call needed for auth verification
  On 401 → client calls /auth/refresh with cookie
```

### Security Checklist

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | JPA parameterized queries, never raw SQL concat |
| XSS | React escapes by default; CSP headers via NGINX |
| CSRF | SameSite=Strict cookies + custom header check |
| Brute Force | Account lockout after 5 failed attempts; rate limit on /auth/login |
| Insecure Direct Object Reference | Always check org membership before returning data |
| Sensitive Data Exposure | Passwords bcrypt-hashed (cost=12); tokens stored hashed |
| Man-in-the-Middle | TLS everywhere; HSTS headers |
| Broken Access Control | Method-level @PreAuthorize on all service endpoints |

### Spring Security Config Skeleton
```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable()) // Using stateless JWT
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .build();
    }
}
```

---

## 7. File Storage (Cloudflare R2)

### Upload Flow
```
1. Client → File Service: POST /files/upload-url {filename, contentType, size}
2. File Service → R2: Generate pre-signed PUT URL (15 min TTL)
3. File Service → Client: { uploadUrl, fileId }
4. Client → R2: PUT {file bytes} directly (bypasses your server)
5. Client → File Service: POST /files/confirm { fileId }
6. File Service: Mark file as confirmed in DB, update org storage quota
```

### Key Structure in R2
```
{orgId}/{teamId}/{year}/{month}/{uuid}.{ext}
```

### Configuration
```yaml
# application.yml
cloudflare:
  r2:
    account-id: ${CF_ACCOUNT_ID}
    access-key: ${CF_R2_ACCESS_KEY}
    secret-key: ${CF_R2_SECRET_KEY}
    bucket: teamos-files
    public-url: https://files.yourdomain.com
```

---

## 8. Search (PostgreSQL Full-Text Search)

### Setup per table
```sql
-- Add FTS column
ALTER TABLE messages ADD COLUMN content_tsv tsvector;

-- Create GIN index
CREATE INDEX CONCURRENTLY messages_fts_idx ON messages USING GIN(content_tsv);

-- Auto-update trigger
CREATE TRIGGER messages_fts_update
BEFORE INSERT OR UPDATE OF content ON messages
FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(content_tsv, 'pg_catalog.english', content);
```

### Search Query with Ranking
```java
@Query(value = """
    SELECT m.*, ts_rank(m.content_tsv, query) AS rank
    FROM messages m,
         to_tsquery('english', :searchQuery) query
    WHERE m.content_tsv @@ query
      AND m.org_id = :orgId
      AND m.deleted_at IS NULL
    ORDER BY rank DESC
    LIMIT :limit OFFSET :offset
    """, nativeQuery = true)
List<MessageSearchResult> searchMessages(
    @Param("searchQuery") String searchQuery,
    @Param("orgId") UUID orgId,
    @Param("limit") int limit,
    @Param("offset") int offset);
```

### Sanitizing User Input for FTS
```java
public String sanitizeForTsQuery(String input) {
    // Replace spaces with & for AND search, | for OR
    return Arrays.stream(input.trim().split("\\s+"))
        .map(word -> word.replaceAll("[^a-zA-Z0-9]", ""))
        .filter(w -> !w.isEmpty())
        .collect(Collectors.joining(" & "));
}
```

---

## 9. Async Messaging (PostgreSQL LISTEN/NOTIFY)

### Use Cases
- Notification delivery (task assigned, mentioned, etc.)
- Triggering email digests
- Cache invalidation across services
- Audit log writing

### Implementation

**Publisher (any service):**
```java
@Component
@RequiredArgsConstructor
public class EventPublisher {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public void publish(String channel, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload)
                .replace("'", "''"); // escape single quotes
            jdbcTemplate.execute("SELECT pg_notify('" + channel + "', '" + json + "')");
        } catch (Exception e) {
            log.error("Failed to publish event", e);
        }
    }
}
```

**Listener (Notification Service):**
```java
@Component
public class PgNotificationListener implements InitializingBean {
    @Autowired private DataSource dataSource;

    @Override
    public void afterPropertiesSet() throws Exception {
        Connection conn = dataSource.getConnection();
        PGConnection pgConn = conn.unwrap(PGConnection.class);
        Statement stmt = conn.createStatement();
        stmt.execute("LISTEN notifications_channel");
        stmt.execute("LISTEN audit_channel");

        // Poll in a virtual thread (Java 21)
        Thread.ofVirtual().start(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    PGNotification[] notifications = pgConn.getNotifications(1000);
                    if (notifications != null) {
                        for (PGNotification n : notifications) {
                            handleNotification(n.getName(), n.getParameter());
                        }
                    }
                } catch (SQLException e) {
                    log.error("Notification polling error", e);
                }
            }
        });
    }
}
```

### Channels

| Channel | Published by | Consumed by |
|---------|-------------|-------------|
| `notifications_channel` | All services | Notification Service |
| `audit_channel` | All services | Audit Service |
| `billing_events` | Org Service | Billing Service |
| `search_index_channel` | Chat, Doc, Task | Search Service (re-index) |

---

## 10. API Design

### Conventions
- **Base URL:** `https://api.yourdomain.com/v1`
- **Authentication:** `Authorization: Bearer {access_token}`
- **Format:** JSON everywhere
- **Pagination:** Cursor-based for chat, offset-based for lists
- **Errors:** RFC 7807 Problem Details format

### Standard Response Envelope
```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task with id '123' does not exist",
    "status": 404
  }
}
```

### Pagination (Cursor-based for Chat)
```
GET /channels/{channelId}/messages?before=msgId&limit=50
→ Returns 50 messages before the given message ID (for infinite scroll up)
```

### Rate Limiting (API Gateway level)
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: chat-service
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
                redis-rate-limiter.requestedTokens: 1
```

---

## 11. Frontend Architecture

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Sidebar + topbar
│   │   ├── home/
│   │   ├── chat/
│   │   │   └── [channelId]/
│   │   ├── projects/
│   │   │   └── [projectId]/
│   │   ├── docs/
│   │   ├── files/
│   │   ├── calendar/
│   │   ├── meetings/
│   │   └── settings/
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── chat/               # Chat-specific components
│   ├── editor/             # Tiptap document editor
│   ├── kanban/             # Kanban board
│   └── shared/             # Layout, nav, etc.
├── lib/
│   ├── api/                # TanStack Query hooks per service
│   ├── ws/                 # STOMP WebSocket client
│   ├── store/              # Zustand stores
│   └── utils/
└── types/                  # TypeScript interfaces
```

### State Management Strategy

| Data Type | Tool | Reason |
|-----------|------|--------|
| Server data (tasks, docs) | TanStack Query | Caching, refetch, optimistic updates |
| UI state (sidebar open, modals) | Zustand | Lightweight, no boilerplate |
| Real-time chat messages | Zustand + WS | Append incoming messages to store |
| Auth state | Zustand + cookie | Persist user session |

### WebSocket Client Setup
```typescript
import { Client } from '@stomp/stompjs';

const stompClient = new Client({
  brokerURL: 'wss://api.yourdomain.com/ws',
  connectHeaders: {
    Authorization: `Bearer ${accessToken}`,
  },
  onConnect: () => {
    stompClient.subscribe(`/topic/channel.${channelId}`, (msg) => {
      const message = JSON.parse(msg.body);
      useChatStore.getState().addMessage(message);
    });
    stompClient.subscribe('/user/queue/notifications', (msg) => {
      const notif = JSON.parse(msg.body);
      useNotificationStore.getState().addNotification(notif);
    });
  },
  reconnectDelay: 5000,
});
```

---

## 12. Infrastructure & DevOps

### Docker Compose (Local Development)
```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: teamos
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  gateway:
    build: ./services/gateway
    ports: ["8080:8080"]
    depends_on: [auth, org, chat, project, document]

  auth:
    build: ./services/auth-service
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/teamos
      SPRING_REDIS_HOST: redis
    ports: ["8081:8081"]

  # ... other services
```

### GitHub Actions CI/CD
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Run Tests
        run: ./mvnw test
      - name: Build Docker Image
        run: docker build -t teamos/auth-service .
      - name: Push to Registry
        run: docker push ghcr.io/yourorg/teamos/auth-service:${{ github.sha }}
      - name: Deploy
        run: |
          ssh deploy@server "docker pull && docker-compose up -d"
```

### Monitoring Stack
```yaml
  prometheus:
    image: prom/prometheus
    volumes: [./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml]

  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]

  loki:
    image: grafana/loki

  jaeger:
    image: jaegertracing/all-in-one
    ports: ["16686:16686"]
```

---

## 13. Service Communication

### Synchronous (REST via Gateway)
- Client → API Gateway → Service (standard REST calls)
- Service-to-service: only when response is needed immediately (e.g., Auth Service verifying a token for another service)

### Asynchronous (PostgreSQL LISTEN/NOTIFY)
- Events that don't need immediate response
- Notifications, audit logs, email triggers, search re-indexing

### Service Discovery
- For MVP: hardcoded service URLs via environment variables
- For production: Spring Cloud Eureka or Kubernetes DNS

---

## 14. MVP Build Order

Build in this sequence — each phase is independently shippable:

### Phase 1 — Foundation (Weeks 1–3)
- [ ] Auth Service (email login + Google OAuth + JWT)
- [ ] API Gateway (routing + JWT validation)
- [ ] Organization Service (create org, invite members, roles)
- [ ] Basic dashboard frontend (Next.js shell, sidebar, routing)

### Phase 2 — Core Communication (Weeks 4–6)
- [ ] Chat Service (channels, DMs, messages)
- [ ] WebSocket integration (STOMP, real-time delivery)
- [ ] Notification Service (in-app + email via LISTEN/NOTIFY)
- [ ] Redis presence (online/offline indicators)

### Phase 3 — Work Management (Weeks 7–9)
- [ ] Project Service (tasks, Kanban, sprint board)
- [ ] Document Service (rich text, folders, version history)
- [ ] File Service (upload to R2, folder view, previews)

### Phase 4 — Collaboration Features (Weeks 10–12)
- [ ] Calendar Service
- [ ] Meeting Service (LiveKit integration)
- [ ] Real-time collaborative documents (Yjs/Hocuspocus)
- [ ] Knowledge Base, Employee Directory

### Phase 5 — Advanced (Weeks 13–16)
- [ ] Analytics Service
- [ ] Approval Workflows
- [ ] Forms Builder
- [ ] Whiteboard
- [ ] AI Assistant (LLM API integration)
- [ ] Billing Service (Stripe integration)
- [ ] Internal App Store / Integrations

---

*End of TRD v1.0*
