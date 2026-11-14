CREATE TABLE tenant_storage_usage (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_attachments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_code VARCHAR(40) NOT NULL,
    record_id UUID NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 VARCHAR(64) NOT NULL,
    storage_key VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    scan_status VARCHAR(16) NOT NULL CHECK (scan_status IN ('CLEAN')),
    uploaded_by UUID NOT NULL REFERENCES app_users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_attachments_storage_key UNIQUE (storage_key),
    CONSTRAINT uk_tenant_attachments_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uk_tenant_attachments_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX ix_tenant_attachments_parent ON tenant_attachments(tenant_id, resource_code, record_id, uploaded_at DESC);
