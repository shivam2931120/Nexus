# Nexus

Nexus is a connected workspace for team communication and work. This repository contains the Phase 1 vertical slice described by `PRD.md`, `TRD.md`, `DESIGN.md`, and `prompt.md`.

## Phase 1 status

Implemented:

- Spring Boot 3 modular backend on Java 21
- PostgreSQL migrations with bounded-context schemas, UUID IDs, audit timestamps, and soft-delete columns
- BCrypt authentication, signed JWT access tokens, protected API routes, and organization membership checks
- Organizations, teams, channels, messages, projects, tasks, documents, and document versions
- STOMP/WebSocket endpoint foundation and persisted REST chat flow
- Editorial-derived document collaboration with conflict-safe saves, realtime version updates, threaded comments, and version restore
- Next.js 15 responsive shell with Nexus design tokens, dark mode, dashboard, chat, Kanban tasks, documents, projects, settings, and login/signup
- Docker Compose, Dockerfiles, GitHub Actions, OpenAPI endpoint support, Actuator health/metrics

Deferred and intentionally documented rather than faked: production email delivery, provider OAuth credentials, refresh-token persistence/rotation, R2 production adapter, LiveKit meetings, full CRDT collaboration, advanced calendar/files/analytics/AI/billing/whiteboard flows, and enterprise deployment.

Editorial integration architecture and verification are documented in [`docs/EDITORIAL_INTEGRATION.md`](docs/EDITORIAL_INTEGRATION.md). Nexus does not depend on the standalone Editorial service at runtime; both applications remain independently deployable.

## Run locally

Prerequisites: Java 21, Maven, Node 22+, npm, Docker.

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

Open `http://localhost:3000`. The API is at `http://localhost:8080`, Swagger UI at `/swagger-ui/index.html`, and health at `/actuator/health`.

For split local development, start PostgreSQL with the compose file (host port `15432`), then run:

```bash
cd backend && mvn spring-boot:run
cd frontend && npm install && npm run dev
```

Register an account at `/login`, create an organization with `POST /api/orgs`, then create a team with `POST /api/orgs/{orgId}/teams`. The frontend currently uses representative local UI states for screens whose production service is still deferred; those boundaries are listed above.

## Validation

```bash
cd backend && mvn verify
cd frontend && npm run typecheck && npm run build
```

Never commit `.env`, OAuth secrets, JWT keys, R2 credentials, or production endpoints.

## Architecture notes

The backend is a modular monolith so Phase 1 remains easy to run and test. Packages map to the service boundaries in the TRD and can be extracted later. PostgreSQL schemas separate bounded contexts, while every organization-owned query is scoped by authenticated membership. STOMP uses `/ws`, `/app`, and `/topic` destinations.
