CREATE TABLE auth_login_limits (
    bucket_key VARCHAR(70) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    blocked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_login_limits_blocked_until ON auth_login_limits(blocked_until);
