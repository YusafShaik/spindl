CREATE TABLE tenant_api_tokens (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by UUID NOT NULL REFERENCES app_users(id),
    name VARCHAR(120) NOT NULL,
    token_prefix VARCHAR(24) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    scopes JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tenant_api_tokens_tenant ON tenant_api_tokens(tenant_id, created_at DESC);

CREATE TABLE tenant_webhook_endpoints (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(120) NOT NULL,
    target_url VARCHAR(2048) NOT NULL,
    secret_ciphertext VARCHAR(1024) NOT NULL,
    event_types JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tenant_webhook_endpoints_tenant ON tenant_webhook_endpoints(tenant_id, created_at DESC);

CREATE TABLE tenant_webhook_deliveries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    endpoint_id UUID NOT NULL REFERENCES tenant_webhook_endpoints(id),
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RETRY','DELIVERED','DEAD')),
    attempt_count SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_response_status INTEGER,
    last_error VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);
CREATE INDEX ix_tenant_webhook_due ON tenant_webhook_deliveries(status, next_attempt_at) WHERE status IN ('PENDING','RETRY');
