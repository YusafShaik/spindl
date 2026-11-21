DROP INDEX IF EXISTS uk_items_tenant_barcode;
ALTER TABLE items DROP COLUMN IF EXISTS barcode;
