CREATE TABLE tenant_saved_reports (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(120) NOT NULL,
    data_source VARCHAR(32) NOT NULL,
    selected_columns JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_saved_report_name UNIQUE (tenant_id, name)
);
CREATE INDEX ix_tenant_saved_reports_tenant ON tenant_saved_reports(tenant_id, created_at DESC);
