ALTER TABLE inventory_movements ADD COLUMN idempotency_key VARCHAR(120);
CREATE UNIQUE INDEX uk_inventory_movements_tenant_idempotency
    ON inventory_movements (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX ix_inventory_movements_tenant_created
    ON inventory_movements (tenant_id, created_at DESC);
