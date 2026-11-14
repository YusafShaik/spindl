ALTER TABLE tenant_webhook_deliveries
    ADD COLUMN replay_count SMALLINT NOT NULL DEFAULT 0;
