ALTER TABLE items ADD COLUMN barcode VARCHAR(64);
CREATE UNIQUE INDEX uk_items_tenant_barcode ON items(tenant_id,upper(barcode)) WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
