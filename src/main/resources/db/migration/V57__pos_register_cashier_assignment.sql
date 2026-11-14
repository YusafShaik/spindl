ALTER TABLE pos_registers ADD COLUMN assigned_cashier_user_id UUID;
CREATE INDEX ix_pos_registers_tenant_cashier ON pos_registers(tenant_id,assigned_cashier_user_id) WHERE active=TRUE;
