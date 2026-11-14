ALTER TABLE items ADD COLUMN item_type VARCHAR(16) NOT NULL DEFAULT 'FINISHED';
ALTER TABLE items ADD CONSTRAINT ck_items_item_type
    CHECK (item_type IN ('RAW','WIP','FINISHED','SERVICE'));
CREATE INDEX ix_items_tenant_type_active ON items(tenant_id,item_type) WHERE active=TRUE;
