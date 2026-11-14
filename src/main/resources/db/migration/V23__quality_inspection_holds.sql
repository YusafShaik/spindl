ALTER TABLE items ADD COLUMN quality_inspection_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN quality_hold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (quality_hold_quantity >= 0);

CREATE TABLE quality_lots (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    item_id UUID NOT NULL REFERENCES items(id),
    source_type VARCHAR(24) NOT NULL CHECK (source_type IN ('PURCHASE_RECEIPT','WORK_ORDER_OUTPUT','OPENING_STOCK')),
    source_reference VARCHAR(120) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
    passed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (passed_quantity >= 0),
    rejected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING','IN_PROGRESS','RELEASED','REJECTED','MIXED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_quality_lot_source UNIQUE (tenant_id, source_type, source_reference)
);
CREATE INDEX ix_quality_lots_queue ON quality_lots(tenant_id, status, created_at);

CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    quality_lot_id UUID NOT NULL REFERENCES quality_lots(id),
    outcome VARCHAR(8) NOT NULL CHECK (outcome IN ('PASS','FAIL')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes VARCHAR(500),
    inspector_user_id UUID NOT NULL REFERENCES app_users(id),
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_quality_inspection_idempotency UNIQUE (tenant_id, idempotency_key)
);
