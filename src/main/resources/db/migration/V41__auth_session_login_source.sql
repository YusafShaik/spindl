ALTER TABLE auth_sessions ADD COLUMN login_source_hash VARCHAR(64);
CREATE INDEX ix_auth_sessions_user_login_source ON auth_sessions(user_id, login_source_hash)
    WHERE revoked_at IS NULL AND login_source_hash IS NOT NULL;
