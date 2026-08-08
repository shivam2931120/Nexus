# Nexus (TeamOS) Phase 1 MVP — Implementation Prompt

You are a senior product engineer responsible for implementing the Nexus (also called TeamOS in the source documents) Phase 1 MVP in the current repository.

## Source of truth

Before changing anything, read these files in full:

1. `PRD.md` — product requirements, priorities, personas, constraints, and out-of-scope items.
2. `TRD.md` — technical architecture, service boundaries, data model, APIs, real-time design, infrastructure, and build order.
3. `DESIGN.md` — visual system, application shell, screen behavior, responsive rules, accessibility, motion, dark mode, and Figma organization.

These documents are the source of truth. Do not invent a different product, visual language, or architecture. If a detail conflicts, apply this precedence:

1. Explicit safety, security, and data-isolation requirements.
2. The TRD for implementation and architectural decisions.
3. The PRD for product behavior and feature priority.
4. The Design Specification for visual and interaction decisions.

Resolve the known scope/model ambiguities as follows:

- Phase 1 is a working, independently demoable vertical slice covering authentication, organizations and teams, the application shell/dashboard, chat, projects/tasks, and documents. Build the boundaries needed for later file, calendar, meeting, notification, search, and analytics modules, but do not pretend that the P1/P2 roadmap is fully implemented.
- Use a modular monolith as the default runnable backend for Phase 1, with strict modules and package boundaries that map to the TRD service boundaries. Keep extraction to independent Spring Boot services possible later. Do not introduce distributed infrastructure merely for appearance.
- Follow the TRD database strategy: one PostgreSQL instance with a schema per bounded context (`auth`, `org`, `chat`, `project`, `document`, and future schemas as needed), UUID v7/time-ordered UUID primary keys, soft deletes, audit fields, and tenant/org scoping. Every tenant-owned query and mutation must be scoped to the authenticated organization. Do not replace this with an unqualified global table or an unsafe ID-only lookup.
- Use PostgreSQL LISTEN/NOTIFY for asynchronous application events where specified by the TRD. Use Redis for presence, cache, and cross-node real-time support. Use STOMP over Spring WebSocket for chat. Use Cloudflare R2 through its S3-compatible API for file assets and attachments; local development may use an explicit mock/in-memory adapter.
- Never place real credentials, private keys, production URLs, or secrets in tracked files. Provide `.env.example` files and safe local defaults only.

## Outcome

Deliver a production-quality, runnable Phase 1 MVP, not a design document or a collection of disconnected examples. Preserve the existing repository’s working behavior if code already exists. If the repository is empty, create the complete project structure below.

The finished implementation must support this demonstrable journey:

1. A new user signs up, verifies the basic account flow as represented in the local-development setup, and signs in.
2. The user creates or joins an organization during onboarding.
3. The user sees the authenticated Nexus shell and dashboard.
4. An organization admin creates a team and invites/adds members with roles.
5. Team members access a channel and exchange messages in real time.
6. An authorized member creates, assigns, updates, and completes a task/project item.
7. A member creates and edits a document, sees version history, and can restore a prior version.
8. A second organization cannot read, modify, subscribe to, or infer the first organization’s data.

## Required repository shape

Use a clean monorepo with a single source of truth for shared contracts where practical:

```text
/
  backend/
    build.gradle.kts or pom.xml
    src/main/java/.../common
    src/main/java/.../auth
    src/main/java/.../org
    src/main/java/.../chat
    src/main/java/.../project
    src/main/java/.../document
    src/main/java/.../notification      # minimal event boundary if needed
    src/main/resources/db/migration
    src/test/java/...
  frontend/
    app/ or pages/                    # choose one Next.js routing model and use it consistently
    components/
    features/
    lib/
    hooks/
    stores/
    tests/
  infra/
    docker-compose.yml
    k8s/
    terraform/
  docs/
    architecture.md
    api.md
    decisions.md
  .github/workflows/
  .env.example
  README.md
```

Choose Maven or Gradle once and configure it completely. Use Java 21, Spring Boot 3.3.x or a compatible current 3.x release, Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui-compatible primitives, Zustand, TanStack Query, STOMP.js, Tiptap, and Lucide React as specified by the TRD. Pin compatible versions; do not use floating or unverified dependencies.

## Backend implementation

### Cross-cutting foundation

- Add Spring Web, Spring Security, validation, Spring Data JPA, PostgreSQL, Flyway or Liquibase, springdoc-openapi, Actuator, Micrometer/Prometheus, WebSocket/STOMP, and Redis support.
- Define shared error handling with a stable JSON error envelope, validation errors, request/correlation IDs, structured logs, and correct HTTP status codes.
- Define a standard response envelope and cursor pagination according to the TRD. Document exceptions clearly.
- Add UTC timestamps, optimistic concurrency where needed, audit fields (`created_at`, `updated_at`, `created_by`, `deleted_at`), and consistent UUID serialization.
- Enforce authorization in the service layer, not only in controllers. Never trust an organization ID supplied by the client without checking membership and active organization context.
- Add health/readiness endpoints and safe configuration for local, test, and production profiles.

### Authentication and authorization

Implement:

- Email/password signup and login with Argon2id or BCrypt hashing.
- Short-lived signed JWT access tokens and rotating refresh tokens. Validate signature, issuer, audience, expiry, and token type on every protected request.
- Secure refresh-token storage (hashed at rest), rotation, revocation, logout, and device/session listing/revocation.
- Password reset token flow with expiry and single use; email delivery can be a local development adapter.
- Account lockout/rate limiting after repeated failed login attempts.
- OAuth2/OIDC provider configuration stubs for Google, GitHub, and Microsoft without fake credentials.
- Organization roles from the PRD/TRD: owner/admin/member, with an extensible permission model. Deny by default.
- Organization membership and team membership checks for REST, WebSocket CONNECT/SUBSCRIBE, and message SEND operations.
- HttpOnly, Secure, SameSite-appropriate cookie handling if cookies are used. If a different token transport is chosen, document the threat model and trade-off.

Required API areas include:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/sessions
DELETE /api/auth/sessions/{sessionId}
```

### Organizations, teams, and dashboard

- Create/list/update organizations, invite members, accept invitations, change roles, and leave an organization where permitted.
- Create/update/archive teams, assign members, configure visibility, and expose team-scoped channels, tasks, documents, and files as boundaries.
- Implement the dashboard requirements: greeting, today’s meetings placeholder/data boundary, pending tasks sorted by deadline, unread notifications boundary, recent documents, recent messages, upcoming deadlines, project progress, team activity, and quick actions.
- Seed a safe local demo dataset only through an explicit development profile or command. Never seed it in production.

### Chat and real time

Implement public/private/announcement channels, direct-message boundaries, paginated message history, message creation/edit/delete, threads, reactions, pins, mentions, read state, typing indicators, presence, and file attachment metadata as feasible for the MVP. Announcements must be admin-restricted.

Configure STOMP over WebSocket with:

```text
Endpoint: /ws
Application prefix: /app
Broker topics: /topic/channel.{channelId}
Typing topic: /topic/channel.{channelId}.typing
Personal queue: /user/queue/notifications
```

Authenticate the STOMP connection and authorize every subscription and send. Persist messages before broadcasting. Prevent a client from publishing to a channel outside its organization/team. Use Redis for presence and cross-node support; use the TRD’s PostgreSQL LISTEN/NOTIFY event boundary for asynchronous notifications where applicable.

Document the message flow and provide a representative payload:

```json
{
  "id": "uuid",
  "channelId": "uuid",
  "organizationId": "uuid",
  "senderId": "uuid",
  "senderName": "Alice",
  "content": "Hello team!",
  "createdAt": "2026-08-04T12:34:56Z"
}
```

### Projects and tasks

Implement the P0 task/project vertical slice: project CRUD, task CRUD, assignment, labels, priority, due date, status workflow (`TO_DO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`), comments/checklists where practical, activity history, and project/team authorization. Support the Kanban view and My Tasks; design the model for epics, stories, subtasks, dependencies, sprints, time logs, backlog, roadmap, burndown, and velocity without claiming all advanced views are complete.

### Documents

Implement document creation, folders, rich text editing with Tiptap (or a documented equivalent), headings, lists, checklists, tables, code blocks, image/file attachment hooks, mentions, comments boundary, document permissions, version history, restore, Markdown/PDF export boundaries, and PostgreSQL full-text-search-ready fields. Collaborative editing may use a clearly isolated Yjs/Hocuspocus or CRDT adapter; if it is deferred, show an explicit disabled state and document the next implementation step rather than presenting single-user editing as real-time collaboration.

### Files and search boundaries

Create the R2 storage abstraction and signed-upload/download flow for document/chat attachments, with organization-scoped object keys and size/type validation. Add PostgreSQL FTS indexes/triggers for messages/documents/tasks where applicable. Do not add Elasticsearch. Provide local adapters and integration points for production credentials.

## Frontend implementation

Build a real responsive Next.js application with protected routes, typed API clients, TanStack Query for server state, Zustand only for appropriate client state, and accessible loading/error/empty states. Do not use placeholder rectangles where a functional component is required.

### Visual system

Follow `DESIGN.md` exactly:

- Inter with system fallbacks; JetBrains Mono for code.
- Indigo brand tokens: `#6366F1`, `#4F46E5`, `#EEF2FF`; semantic success/warning/danger/info colors; documented light and dark neutrals.
- 4px spacing scale, documented radii and shadows, Lucide icons at the specified sizes/stroke weight.
- Use shared tokens/primitives for buttons, inputs, badges, avatars, cards, modals, toasts, dropdowns, tables, tooltips, loading states, and empty states.
- Support system dark mode plus a manual setting. Maintain WCAG AA contrast in both themes; never use near-black text on dark surfaces or low-contrast muted text for essential content.
- Keep the product name consistent as Nexus in user-facing UI, while documenting TeamOS as the source/working name where necessary.

### Application shell and screens

Implement the 48px app bar with logo/wordmark, organization switcher, Cmd/Ctrl+K global search entry, help, notification badge, and user menu. Implement the 240px collapsible sidebar with Home, My Tasks, Inbox, team sections, Projects, Calendar, Meetings, File Drive, Knowledge Base, Directory, Analytics, Settings, and Upgrade Plan. Implement the 320px context panel for task details, threads, file previews, and notification details.

Build at minimum:

- Onboarding: sign up, login, verification/reset states, create/join organization, invite team.
- Dashboard/home with the Design Spec’s widget composition and quick actions.
- Chat channel view, DM-ready boundary, thread panel, message composer, reactions, presence, typing, unread state, and responsive mobile view.
- Project/task Kanban, task detail panel, My Tasks, and create/edit flows.
- Documents folder/list view, editor empty/content states, save status, comments/version panel, and restore action.
- Settings for profile, appearance, notifications, members/roles, and billing placeholder.

Use real data from the API where the corresponding backend exists. Loading, empty, error, optimistic update, reconnect, and permission-denied states are required. Destructive actions need confirmation and recoverable soft-delete behavior.

### Responsive and accessible behavior

Use the Design Spec breakpoints: mobile 0–767px, tablet 768–1023px, desktop 1024–1279px, wide 1280px+. On mobile the sidebar becomes a hamburger/overlay, chat becomes full screen, threads become overlays, Kanban scrolls or stacks as specified, dashboard widgets stack, and analytics simplify. Do not allow fixed-width content to create page-level horizontal overflow.

Meet WCAG 2.1 AA expectations: logical keyboard order, visible 2px indigo focus ring, meaningful alt text, ARIA labels for icon-only controls, screen-reader announcements for real-time events, non-color status indicators, reduced-motion support, and keyboard shortcuts from `DESIGN.md` (`Cmd/Ctrl+K`, `Cmd/Ctrl+/`, `Cmd/Ctrl+N`, `Cmd/Ctrl+Shift+D`, `Alt+Shift+M`, `Esc`, `J/K`, `E`).

## Infrastructure and documentation

Provide safe, runnable development infrastructure:

- Dockerfiles and `infra/docker-compose.yml` for PostgreSQL 16, Redis 7, backend, frontend, and optional observability dependencies.
- SQL migrations for every implemented schema, constraints, indexes, FTS triggers, and seed data only for development.
- OpenAPI/Swagger documentation with examples for implemented APIs.
- Kubernetes examples using ConfigMaps/Secrets and health probes; clearly label them as examples if not production-ready.
- Terraform modules/examples for PostgreSQL/RDS, Redis/ElastiCache, R2-compatible storage, networking, and secrets references. Do not hardcode credentials.
- GitHub Actions workflows that install dependencies, lint, typecheck, test, build backend/frontend, build containers, and optionally publish images only when registry secrets exist.
- Structured logging, Actuator/Prometheus metrics, health checks, and a concise observability runbook.
- `README.md` with prerequisites, environment setup, migration/seed commands, local run commands, Docker commands, test commands, API docs, WebSocket usage, architecture, security notes, and known limitations.
- `docs/decisions.md` explaining modular monolith vs microservices, schema-per-service multi-tenancy, token transport, real-time architecture, and deferred roadmap items.

## Testing and acceptance criteria

Write meaningful tests, not empty test classes:

- Backend unit tests for validation, authorization, tenant/org scoping, token handling, and service rules.
- Backend integration tests for auth, organization/team CRUD, task/document CRUD, migrations, and cross-organization isolation. Use Testcontainers where appropriate.
- WebSocket tests for authenticated connect, authorized subscribe/send, persistence-before-broadcast, and cross-tenant rejection.
- Frontend tests for login, protected route behavior, dashboard loading/error states, task creation/update, document save/version restore, and accessible navigation.
- Add linting, formatting, type checking, and build checks. Target at least 80% coverage for the implemented core modules where practical.

The implementation is complete only when:

1. A clean local setup from the README starts the required services.
2. Backend migrations run successfully and the application starts without secrets committed.
3. Frontend lint, typecheck, tests, and production build pass.
4. Backend tests and production build pass.
5. The documented end-to-end journey works with local development data.
6. Cross-tenant REST and WebSocket access is rejected and covered by tests.
7. Light/dark themes, responsive breakpoints, keyboard navigation, and empty/error/loading states are verified on every implemented screen.
8. No claimed feature is silently mocked; deferred work is visibly labeled and recorded in documentation.

## Execution rules

Work in milestones and keep the project runnable after each milestone:

1. Repository and build foundation.
2. Database, shared security, authentication, and organization/team modules.
3. Next.js shell, onboarding, dashboard, and responsive design system.
4. Chat persistence and authenticated real-time flow.
5. Projects/tasks and documents/versioning.
6. Files/search boundaries, infrastructure, observability, documentation, and final QA.

At the beginning, inspect the existing files and report the implementation plan. Then implement the highest-value complete slice, run validation, fix failures, and continue. Do not generate a giant unverified dump of files. Keep commits or logical changes separable when version control is available.

At the end, report:

- What was implemented and what remains deferred.
- The final repository tree and important routes/API endpoints.
- Commands run and their pass/fail results.
- Any environment variables or external services still required.
- Any known limitations or follow-up work.

Do not claim a deployment, external OAuth configuration, R2 bucket, Kubernetes cluster, or production release unless it was actually executed and verified.
