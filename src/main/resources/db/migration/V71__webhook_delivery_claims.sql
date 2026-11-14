ALTER TABLE tenant_webhook_deliveries
    DROP CONSTRAINT tenant_webhook_deliveries_status_check,
    ADD CONSTRAINT ck_tenant_webhook_delivery_status CHECK (status IN ('PENDING','RETRY','PROCESSING','DELIVERED','DEAD')),
    ADD COLUMN claimed_at TIMESTAMPTZ;
