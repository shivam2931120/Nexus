# Editorial integration

Nexus incorporates Editorial's document-collaboration capabilities as a native bounded context. It does not call the standalone Editorial deployment at runtime.

This is capability replication, not data synchronization: each product keeps separate users, documents, comments, versions, credentials, databases, URLs, and release cycles.

## Why this boundary

- Nexus remains authoritative for Clerk/local JWT identity, organizations, teams, and authorization.
- Nexus PostgreSQL and Flyway remain authoritative for documents, versions, comments, and audit history.
- Editorial remains independently deployable and keeps its Supabase and Socket.IO contracts.
- A failure or deployment of either application cannot take down the other application.
- No user IDs, organization IDs, tokens, or document IDs are translated between databases at request time.
- Neither repository is installed as a package dependency of the other.

## Integrated capabilities

- Optimistic version checks prevent an older browser tab from silently overwriting a newer saved version.
- Document saves and restores publish tenant-authorized STOMP updates on `/topic/document.{documentId}`.
- Threaded comments publish updates on `/topic/document.{documentId}.comments`.
- Comment create, reply, resolve, reopen, and delete operations validate Nexus document membership.
- Historical versions can be restored while preserving the pre-restore state in version history.
- The Nexus document UI reports live/offline state and reconnects STOMP after five seconds.

## Security boundary

STOMP subscriptions for document topics are checked against the document's organization and optional team. REST calls perform the same organization/team membership check. Comment authors or workspace document managers can edit/delete comments; all authorized document members can comment and resolve threads.

## Database migration

Flyway migration `V9__editorial_document_collaboration.sql` extends `document.comments` with persisted thread and resolution metadata. It is additive and does not rewrite existing document content.

## Deliberate compatibility decisions

Nexus currently stores Markdown documents and Editorial stores Tiptap HTML. Existing Nexus documents are not silently converted because that would be lossy and could corrupt formatting. A future Tiptap/Yjs migration should introduce an explicit `content_format` column, convert documents with a reversible migration, and retain the Markdown source until verified.

The current realtime channel distributes conflict-safe saved versions and comments. It is not presented as character-level CRDT editing. Yjs/Hocuspocus should be added as an isolated collaboration service when character-level concurrent editing is required.

## Verification

Run:

```bash
cd backend
mvn test

cd ../frontend
npm run typecheck
npm run build
```

Editorial should be verified separately from `/home/shivam/realtime_collab`; Nexus does not require its environment variables or services.
