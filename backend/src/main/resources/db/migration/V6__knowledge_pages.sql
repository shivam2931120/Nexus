CREATE SCHEMA IF NOT EXISTS knowledge;

CREATE TABLE knowledge.pages (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id),
  team_id UUID REFERENCES org.teams(id),
  parent_id UUID REFERENCES knowledge.pages(id),
  title VARCHAR(240) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_pages_org_updated ON knowledge.pages(organization_id, updated_at DESC);
CREATE INDEX idx_knowledge_pages_parent ON knowledge.pages(parent_id);
