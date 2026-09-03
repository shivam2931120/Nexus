CREATE TABLE IF NOT EXISTS calendar.event_reminders (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
  reminder_minutes INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, reminder_minutes)
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON calendar.event_reminders(event_id, sent_at DESC);
