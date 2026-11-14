ALTER TABLE customers ADD COLUMN merged_into_customer_id UUID;
ALTER TABLE customers ADD CONSTRAINT uk_customers_tenant_id UNIQUE (tenant_id,id);
ALTER TABLE customers ADD CONSTRAINT fk_customer_merged_into_same_tenant
    FOREIGN KEY (tenant_id,merged_into_customer_id) REFERENCES customers(tenant_id,id);
ALTER TABLE customers ADD CONSTRAINT ck_customer_not_merged_into_self
    CHECK (merged_into_customer_id IS NULL OR merged_into_customer_id<>id);
CREATE INDEX ix_customers_merged_into ON customers(tenant_id,merged_into_customer_id) WHERE merged_into_customer_id IS NOT NULL;
