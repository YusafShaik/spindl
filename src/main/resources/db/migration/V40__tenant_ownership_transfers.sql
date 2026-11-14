CREATE TABLE tenant_ownership_transfers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES app_users(id),
    to_user_id UUID NOT NULL REFERENCES app_users(id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ownership_transfer_different_users CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX uk_ownership_transfer_pending_tenant ON tenant_ownership_transfers(tenant_id)
    WHERE accepted_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX ix_ownership_transfer_expiry ON tenant_ownership_transfers(expires_at);
