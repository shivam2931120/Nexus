-- Editorial collaboration capabilities, kept inside Nexus's tenant-safe document context.
ALTER TABLE document.comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES document.comments(id) ON DELETE CASCADE;
ALTER TABLE document.comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE document.comments ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES nexus_auth.users(id);
ALTER TABLE document.comments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_document_comments_parent
  ON document.comments(parent_id, created_at);

