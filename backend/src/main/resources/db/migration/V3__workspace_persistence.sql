CREATE SCHEMA IF NOT EXISTS calendar;
CREATE SCHEMA IF NOT EXISTS nexus_storage;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE calendar.events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id),
  team_id UUID REFERENCES org.teams(id),
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'WORK',
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE nexus_storage.files (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id),
  team_id UUID REFERENCES org.teams(id),
  name VARCHAR(255) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(160) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE org.invitations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  invited_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ
);

CREATE TABLE notification.notifications (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES org.organizations(id),
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(240) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit.events (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES org.organizations(id),
  actor_id UUID NOT NULL REFERENCES nexus_auth.users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_org_start ON calendar.events(organization_id, starts_at);
CREATE INDEX idx_storage_files_org_created ON nexus_storage.files(organization_id, created_at DESC);
CREATE INDEX idx_invitations_org_status ON org.invitations(organization_id, status);
CREATE INDEX idx_notifications_user_created ON notification.notifications(user_id, created_at DESC);
CREATE INDEX idx_audit_org_created ON audit.events(organization_id, created_at DESC);
