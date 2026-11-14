INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), t.id, 'MANAGER', 'manufacturing', '*', 'assign'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1
    FROM tenant_role_permissions p
    WHERE p.tenant_id = t.id
      AND p.role = 'MANAGER'
      AND p.module = 'manufacturing'
      AND p.resource = '*'
      AND p.action = 'assign'
);
