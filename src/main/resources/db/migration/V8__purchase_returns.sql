ALTER TABLE purchase_order_lines ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_lines ADD CONSTRAINT ck_purchase_line_returned CHECK (returned_quantity >= 0 AND returned_quantity <= accepted_quantity);

CREATE TABLE purchase_returns (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    return_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_purchase_returns_tenant_number UNIQUE (tenant_id, return_number),
    CONSTRAINT uk_purchase_returns_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_purchase_returns_tenant_order ON purchase_returns (tenant_id, purchase_order_id, returned_at DESC);

CREATE TABLE purchase_return_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id),
    purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
