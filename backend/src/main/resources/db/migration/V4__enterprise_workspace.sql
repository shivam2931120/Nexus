CREATE SCHEMA IF NOT EXISTS meeting;

CREATE TABLE meeting.meetings (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES org.organizations(id),
  team_id UUID REFERENCES org.teams(id),
  title VARCHAR(240) NOT NULL,
  room_name VARCHAR(120) NOT NULL UNIQUE,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_by UUID NOT NULL REFERENCES nexus_auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TABLE meeting.participants (
  meeting_id UUID NOT NULL REFERENCES meeting.meetings(id),
  user_id UUID NOT NULL REFERENCES nexus_auth.users(id),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id,user_id)
);
CREATE INDEX idx_meetings_org_schedule ON meeting.meetings(organization_id,scheduled_at);
CREATE INDEX idx_meeting_participants_user ON meeting.participants(user_id);
