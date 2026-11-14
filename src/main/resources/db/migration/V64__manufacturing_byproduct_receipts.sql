ALTER TABLE work_order_outputs
    ADD COLUMN byproduct_fingerprint VARCHAR(64) NOT NULL DEFAULT '';

CREATE TABLE work_order_byproduct_outputs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    output_id UUID NOT NULL REFERENCES work_order_outputs(id),
    item_id UUID NOT NULL REFERENCES items(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_work_order_byproduct_output_line UNIQUE (output_id, item_id, warehouse_id)
);

CREATE INDEX ix_work_order_byproduct_tenant_order ON work_order_byproduct_outputs(tenant_id, work_order_id);
