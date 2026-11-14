CREATE TABLE tenant_invitations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(254) NOT NULL,
    role VARCHAR(24) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES app_users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tenant_invitations_pending ON tenant_invitations(tenant_id, expires_at) WHERE accepted_at IS NULL;
