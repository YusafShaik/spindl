CREATE TABLE import_batches (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    resource_type VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    rows_imported INTEGER NOT NULL CHECK (rows_imported > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_import_batches_tenant_resource_key UNIQUE (tenant_id, resource_type, idempotency_key)
);
CREATE INDEX ix_import_batches_tenant_created ON import_batches (tenant_id, created_at DESC);
