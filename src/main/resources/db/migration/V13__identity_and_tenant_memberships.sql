CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_app_users_email UNIQUE (email)
);

CREATE TABLE tenant_memberships (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES app_users(id),
    role VARCHAR(24) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_memberships_tenant_user UNIQUE (tenant_id, user_id),
    CONSTRAINT ck_tenant_memberships_role CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'))
);
CREATE INDEX ix_tenant_memberships_user ON tenant_memberships(user_id, active);

CREATE TABLE tenant_audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    actor_user_id UUID REFERENCES app_users(id),
    event_type VARCHAR(80) NOT NULL,
    subject_type VARCHAR(80) NOT NULL,
    subject_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tenant_audit_events_tenant_time ON tenant_audit_events(tenant_id, created_at DESC);
