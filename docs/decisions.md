# Architecture decisions

## Modular monolith first

Phase 1 uses one Spring Boot deployment with strict `auth`, `org`, `chat`, `project`, and `document` packages. This keeps local development and transactional workflows reliable while preserving extraction seams from the TRD.

## Schema-per-service multi-tenancy

One PostgreSQL instance owns a schema per bounded context. Organization IDs are present on every tenant-owned record and are checked against the authenticated membership before reads, writes, and real-time subscriptions. UUID identifiers, soft deletes, and audit timestamps follow the TRD.

## Real time

REST persists chat messages. STOMP/WebSocket is the delivery boundary; Redis provides presence/cross-node support and PostgreSQL LISTEN/NOTIFY is reserved for asynchronous events. A production deployment must add WebSocket-level membership authorization before allowing arbitrary topic subscriptions.

## Deferred work

R2, email, OAuth providers, refresh-token storage/rotation, LiveKit, CRDT editing, and P1/P2 product areas are represented as extension points and are not presented as complete features in this milestone.
