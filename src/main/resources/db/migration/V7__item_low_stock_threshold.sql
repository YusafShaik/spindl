ALTER TABLE items ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10;
ALTER TABLE items ADD CONSTRAINT ck_items_low_stock_threshold CHECK (low_stock_threshold >= 0);
CREATE INDEX ix_items_tenant_low_stock ON items (tenant_id, active, on_hand, low_stock_threshold);
