CREATE SCHEMA IF NOT EXISTS whiteboard;

CREATE TABLE IF NOT EXISTS chat.message_reactions (
  message_id UUID NOT NULL REFERENCES chat.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id),
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS chat.pinned_messages (
  channel_id UUID NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat.messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, message_id)
);
CREATE TABLE IF NOT EXISTS chat.channel_members (
  channel_id UUID NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS project.task_comments (
  id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project.task_checklist_items (
  id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL, completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project.task_labels (
  task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL, PRIMARY KEY (task_id, label)
);
CREATE TABLE IF NOT EXISTS project.task_dependencies (
  task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(24) NOT NULL DEFAULT 'BLOCKS',
  PRIMARY KEY (task_id, depends_on_task_id)
);
CREATE TABLE IF NOT EXISTS project.task_time_logs (
  id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES project.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), minutes INTEGER NOT NULL,
  description VARCHAR(500), logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project.sprints (
  id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES project.projects(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL, goal TEXT, starts_at DATE, ends_at DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'PLANNED', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project.milestones (
  id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES project.projects(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL, due_date DATE, status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document.folders (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id),
  team_id UUID REFERENCES org.teams(id), parent_id UUID REFERENCES document.folders(id),
  name VARCHAR(180) NOT NULL, created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document.comments (
  id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES document.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), content TEXT NOT NULL,
  selection_start INTEGER, selection_end INTEGER, resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.employee_profiles (
  user_id UUID PRIMARY KEY REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES org.organizations(id) ON DELETE CASCADE,
  title VARCHAR(160), department VARCHAR(160), bio TEXT, skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  location VARCHAR(160), availability VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
  manager_id UUID REFERENCES nexus_auth.users(id), avatar_url TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE calendar.events ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(500);
ALTER TABLE calendar.events ADD COLUMN IF NOT EXISTS location VARCHAR(240);
CREATE TABLE IF NOT EXISTS calendar.event_attendees (
  event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting.notes (
  id UUID PRIMARY KEY, meeting_id UUID NOT NULL REFERENCES meeting.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meeting.chat_messages (
  id UUID PRIMARY KEY, meeting_id UUID NOT NULL REFERENCES meeting.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id), content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whiteboard.boards (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES org.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES org.teams(id), name VARCHAR(180) NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON project.task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document.comments(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_meeting ON meeting.chat_messages(meeting_id, created_at);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_org ON org.employee_profiles(organization_id);
