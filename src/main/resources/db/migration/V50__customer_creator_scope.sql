ALTER TABLE customers ADD COLUMN created_by UUID REFERENCES app_users(id);

-- Attribute historical workspace customers to the earliest active owner where one exists.
UPDATE customers c
SET created_by = (
    SELECT m.user_id
    FROM tenant_memberships m
    WHERE m.tenant_id = c.tenant_id AND m.active = TRUE AND m.role = 'OWNER'
    ORDER BY m.created_at ASC
    LIMIT 1
)
WHERE c.created_by IS NULL;

CREATE INDEX ix_customers_tenant_creator_active_name
    ON customers (tenant_id, created_by, name)
    WHERE active = TRUE;
