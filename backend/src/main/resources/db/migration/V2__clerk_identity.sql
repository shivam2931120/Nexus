DO $$
BEGIN
  IF to_regclass('nexus_auth.users') IS NULL AND to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE auth.users SET SCHEMA nexus_auth;
    IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
      ALTER TABLE auth.refresh_tokens SET SCHEMA nexus_auth;
    END IF;
  END IF;
END $$;
ALTER TABLE nexus_auth.users ADD COLUMN clerk_id VARCHAR(255);
CREATE UNIQUE INDEX users_clerk_id_uq ON nexus_auth.users(clerk_id) WHERE clerk_id IS NOT NULL;
