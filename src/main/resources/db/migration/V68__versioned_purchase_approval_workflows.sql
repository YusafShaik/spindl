ALTER TABLE purchase_orders
    ADD COLUMN created_by UUID REFERENCES app_users(id),
    ADD COLUMN approval_required_count SMALLINT NOT NULL DEFAULT 1 CHECK (approval_required_count BETWEEN 1 AND 3);

CREATE TABLE tenant_workflow_versions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    workflow_key VARCHAR(48) NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    status VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ROLLED_BACK')),
    configuration JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CONSTRAINT uk_tenant_workflow_version UNIQUE (tenant_id, workflow_key, version)
);
CREATE INDEX ix_tenant_workflow_published ON tenant_workflow_versions(tenant_id, workflow_key, status, version DESC);

CREATE TABLE purchase_order_approvals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    approver_user_id UUID NOT NULL REFERENCES app_users(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_po_approval_actor UNIQUE (tenant_id, purchase_order_id, approver_user_id)
);
