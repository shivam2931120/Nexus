CREATE SCHEMA IF NOT EXISTS integration;
CREATE TABLE integration.google_connections (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES org.organizations(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
