ALTER TABLE pos_sales ADD COLUMN void_idempotency_key VARCHAR(120);
ALTER TABLE pos_sales ADD COLUMN void_payload_hash VARCHAR(64);
ALTER TABLE pos_sales ADD COLUMN void_reason VARCHAR(300);
ALTER TABLE pos_sales ADD COLUMN voided_by UUID;
ALTER TABLE pos_sales ADD COLUMN voided_at TIMESTAMPTZ;
ALTER TABLE pos_sales ADD CONSTRAINT uk_pos_sales_tenant_void_idempotency UNIQUE (tenant_id,void_idempotency_key);
ALTER TABLE pos_sales ADD CONSTRAINT ck_pos_sales_void_fields CHECK (
    (status='VOIDED' AND void_idempotency_key IS NOT NULL AND void_payload_hash IS NOT NULL AND void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL AND refunded_total=0)
    OR (status<>'VOIDED' AND void_idempotency_key IS NULL AND void_payload_hash IS NULL AND void_reason IS NULL AND voided_by IS NULL AND voided_at IS NULL)
);
