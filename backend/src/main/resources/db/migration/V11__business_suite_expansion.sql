-- Complete collaboration, storage, forms, calendar, and project planning without
-- replacing any existing records or API contracts.

ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'SENT';
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES nexus_auth.users(id);
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS moderation_reason text;

CREATE TABLE IF NOT EXISTS chat.message_mentions (
  message_id uuid NOT NULL REFERENCES chat.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS chat.moderation_actions (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES org.organizations(id),
  channel_id uuid NOT NULL REFERENCES chat.channels(id), message_id uuid REFERENCES chat.messages(id),
  actor_id uuid NOT NULL REFERENCES nexus_auth.users(id), action varchar(32) NOT NULL,
  reason text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nexus_storage.folders (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES org.organizations(id),
  team_id uuid REFERENCES org.teams(id), parent_id uuid REFERENCES nexus_storage.folders(id),
  name varchar(180) NOT NULL, created_by uuid NOT NULL REFERENCES nexus_auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE nexus_storage.files ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES nexus_storage.folders(id);
ALTER TABLE nexus_storage.files ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;
ALTER TABLE nexus_storage.files ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS nexus_storage.file_versions (
  id uuid PRIMARY KEY, file_id uuid NOT NULL REFERENCES nexus_storage.files(id) ON DELETE CASCADE,
  version_number integer NOT NULL, object_key text NOT NULL, size_bytes bigint NOT NULL DEFAULT 0,
  mime_type varchar(255), created_by uuid NOT NULL REFERENCES nexus_auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(file_id,version_number)
);
CREATE TABLE IF NOT EXISTS nexus_storage.shared_links (
  id uuid PRIMARY KEY, file_id uuid NOT NULL REFERENCES nexus_storage.files(id) ON DELETE CASCADE,
  token varchar(96) NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES nexus_auth.users(id),
  expires_at timestamptz, max_downloads integer, download_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nexus_form.forms ADD COLUMN IF NOT EXISTS anonymous_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE nexus_form.forms ADD COLUMN IF NOT EXISTS approval_route jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE nexus_form.forms ADD COLUMN IF NOT EXISTS public_slug varchar(80);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_public_slug ON nexus_form.forms(public_slug) WHERE public_slug IS NOT NULL;
ALTER TABLE nexus_form.submissions ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE nexus_form.submissions ADD COLUMN IF NOT EXISTS submitter_label varchar(180);
CREATE TABLE IF NOT EXISTS nexus_form.submission_approvals (
  id uuid PRIMARY KEY, submission_id uuid NOT NULL REFERENCES nexus_form.submissions(id) ON DELETE CASCADE,
  step_number integer NOT NULL, approver_role varchar(32), approver_id uuid REFERENCES nexus_auth.users(id),
  status varchar(24) NOT NULL DEFAULT 'PENDING', note text, decided_at timestamptz,
  UNIQUE(submission_id,step_number)
);

ALTER TABLE calendar.events ADD COLUMN IF NOT EXISTS reminder_minutes integer[] NOT NULL DEFAULT '{}';
ALTER TABLE calendar.events ADD COLUMN IF NOT EXISTS google_event_id varchar(255);
ALTER TABLE calendar.events ADD COLUMN IF NOT EXISTS sync_status varchar(24) NOT NULL DEFAULT 'LOCAL';
CREATE TABLE IF NOT EXISTS calendar.resources (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES org.organizations(id),
  name varchar(180) NOT NULL, type varchar(50) NOT NULL DEFAULT 'ROOM', capacity integer,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS calendar.resource_bookings (
  id uuid PRIMARY KEY, resource_id uuid NOT NULL REFERENCES calendar.resources(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  UNIQUE(resource_id,event_id)
);
CREATE TABLE IF NOT EXISTS calendar.availability (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES org.organizations(id),
  user_id uuid NOT NULL REFERENCES nexus_auth.users(id), weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL, ends_at time NOT NULL, timezone varchar(80) NOT NULL DEFAULT 'UTC',
  UNIQUE(organization_id,user_id,weekday,starts_at)
);

ALTER TABLE project.projects ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'PLANNING';
ALTER TABLE project.projects ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE project.projects ADD COLUMN IF NOT EXISTS ends_on date;
ALTER TABLE project.projects ADD COLUMN IF NOT EXISTS budget numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE project.projects ADD COLUMN IF NOT EXISTS health varchar(16) NOT NULL DEFAULT 'GREEN';
CREATE TABLE IF NOT EXISTS project.risks (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES project.projects(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL, description text, probability integer NOT NULL DEFAULT 1,
  impact integer NOT NULL DEFAULT 1, status varchar(24) NOT NULL DEFAULT 'OPEN',
  owner_id uuid REFERENCES nexus_auth.users(id), mitigation text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project.templates (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES org.organizations(id),
  name varchar(180) NOT NULL, description text, tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES nexus_auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_schedule ON chat.messages(status,scheduled_at);
CREATE INDEX IF NOT EXISTS idx_files_folder ON nexus_storage.files(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_google ON calendar.events(organization_id,google_event_id);
ALTER TABLE integration.google_connections ADD COLUMN IF NOT EXISTS sync_token text;
ALTER TABLE integration.google_connections ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_risks_project ON project.risks(project_id,status);
