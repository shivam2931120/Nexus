CREATE TABLE notification.preferences (
  user_id UUID PRIMARY KEY REFERENCES nexus_auth.users(id),
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  task_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mention_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  meeting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  document_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  do_not_disturb BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
