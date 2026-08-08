CREATE SCHEMA IF NOT EXISTS nexus_auth;
CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS project;
CREATE SCHEMA IF NOT EXISTS document;

CREATE TABLE nexus_auth.users (
  id UUID PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE nexus_auth.refresh_tokens (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES nexus_auth.users(id), token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE org.organizations (
  id UUID PRIMARY KEY, name VARCHAR(160) NOT NULL, slug VARCHAR(180) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE org.memberships (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), user_id UUID NOT NULL REFERENCES nexus_auth.users(id), role VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,user_id)
);
CREATE TABLE org.teams (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), name VARCHAR(120) NOT NULL, description VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE org.team_members (team_id UUID NOT NULL REFERENCES org.teams(id), user_id UUID NOT NULL REFERENCES nexus_auth.users(id), PRIMARY KEY(team_id,user_id));
CREATE TABLE chat.channels (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), team_id UUID REFERENCES org.teams(id), name VARCHAR(120) NOT NULL, type VARCHAR(20) NOT NULL DEFAULT 'PUBLIC', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE chat.messages (
  id UUID PRIMARY KEY, channel_id UUID NOT NULL REFERENCES chat.channels(id), organization_id UUID NOT NULL REFERENCES org.organizations(id), sender_id UUID NOT NULL REFERENCES nexus_auth.users(id), content TEXT NOT NULL, parent_id UUID REFERENCES chat.messages(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), edited_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE project.projects (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), team_id UUID NOT NULL REFERENCES org.teams(id), name VARCHAR(180) NOT NULL, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE project.tasks (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), project_id UUID REFERENCES project.projects(id), team_id UUID NOT NULL REFERENCES org.teams(id), title VARCHAR(240) NOT NULL, description TEXT, status VARCHAR(20) NOT NULL DEFAULT 'TO_DO', priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', assignee_id UUID REFERENCES nexus_auth.users(id), due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE document.documents (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id), team_id UUID NOT NULL REFERENCES org.teams(id), title VARCHAR(240) NOT NULL, content TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created_by UUID NOT NULL REFERENCES nexus_auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE document.document_versions (
  id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES document.documents(id), version INTEGER NOT NULL, title VARCHAR(240) NOT NULL, content TEXT NOT NULL, created_by UUID NOT NULL REFERENCES nexus_auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(document_id,version)
);
CREATE INDEX idx_membership_user ON org.memberships(user_id);
CREATE INDEX idx_messages_channel_created ON chat.messages(channel_id,created_at);
CREATE INDEX idx_tasks_org_status ON project.tasks(organization_id,status);
CREATE INDEX idx_documents_org_updated ON document.documents(organization_id,updated_at);
