ALTER TABLE inventory_transfers
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'RECEIVED',
    ADD COLUMN approved_by UUID,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN dispatched_at TIMESTAMPTZ,
    ADD COLUMN received_at TIMESTAMPTZ;

-- Existing transfers posted both ledger legs at creation, so they are complete.
UPDATE inventory_transfers SET received_at=created_at;

CREATE INDEX ix_inventory_transfers_tenant_status_created
    ON inventory_transfers(tenant_id,status,created_at DESC);

INSERT INTO tenant_role_permissions (id,tenant_id,role,module,resource,action)
SELECT gen_random_uuid(),t.id,'MANAGER','inventory','*',required.action
FROM tenants t
CROSS JOIN (VALUES ('approve'),('fulfill'),('receive')) AS required(action)
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_role_permissions p
    WHERE p.tenant_id=t.id AND p.role='MANAGER' AND p.module='inventory'
      AND p.resource='*' AND p.action=required.action AND p.permission_scope='ALL'
);
