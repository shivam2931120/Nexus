CREATE SCHEMA IF NOT EXISTS nexus_form;

CREATE TABLE nexus_form.forms (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES org.teams(id),
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(32) NOT NULL DEFAULT 'OTHER',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE nexus_form.submissions (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES nexus_form.forms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES org.organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  reviewed_by UUID REFERENCES nexus_auth.users(id),
  review_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_org_status ON nexus_form.forms(organization_id, status, updated_at DESC);
CREATE INDEX idx_forms_team ON nexus_form.forms(team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_form_submissions_form ON nexus_form.submissions(form_id, submitted_at DESC);
CREATE INDEX idx_form_submissions_user ON nexus_form.submissions(submitted_by, submitted_at DESC);
CREATE INDEX idx_form_submissions_org_status ON nexus_form.submissions(organization_id, status, submitted_at DESC);
