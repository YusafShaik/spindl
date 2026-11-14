CREATE TABLE inventory_cycle_counts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('COUNTING','REVIEW','POSTED','CANCELLED')),
    notes VARCHAR(500),
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ
);
CREATE INDEX ix_inventory_cycle_counts_tenant_created ON inventory_cycle_counts(tenant_id, created_at DESC);

CREATE TABLE inventory_cycle_count_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    cycle_count_id UUID NOT NULL REFERENCES inventory_cycle_counts(id),
    item_id UUID NOT NULL REFERENCES items(id),
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    unit VARCHAR(24) NOT NULL,
    system_quantity INTEGER NOT NULL,
    counted_quantity INTEGER,
    CONSTRAINT uk_cycle_count_item UNIQUE (cycle_count_id, item_id),
    CONSTRAINT ck_cycle_count_quantity CHECK (system_quantity >= 0 AND (counted_quantity IS NULL OR counted_quantity >= 0))
);
CREATE INDEX ix_inventory_cycle_count_lines_tenant_session ON inventory_cycle_count_lines(tenant_id, cycle_count_id);
