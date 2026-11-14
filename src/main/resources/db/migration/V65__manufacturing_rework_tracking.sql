ALTER TABLE work_orders ADD COLUMN rework_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rework_quantity >= 0);
ALTER TABLE work_order_outputs ADD COLUMN rework_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rework_quantity >= 0);
ALTER TABLE work_order_operations ADD COLUMN rework_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rework_quantity >= 0);

CREATE TABLE work_order_rework_dispositions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    good_quantity INTEGER NOT NULL CHECK (good_quantity >= 0),
    scrap_quantity INTEGER NOT NULL CHECK (scrap_quantity >= 0),
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_work_order_rework_disposition_total CHECK (good_quantity + scrap_quantity = quantity),
    CONSTRAINT uk_work_order_rework_disposition_key UNIQUE (tenant_id, idempotency_key)
);
