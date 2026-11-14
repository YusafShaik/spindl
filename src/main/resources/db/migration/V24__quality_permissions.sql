INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), t.id, g.role, 'quality', g.resource, g.action
FROM tenants t
CROSS JOIN (VALUES
    ('MANAGER','*','view'),('MANAGER','*','create'),('MANAGER','*','edit'),('MANAGER','*','approve'),
    ('OPERATOR','*','view'),('OPERATOR','inspections','create')
) AS g(role, resource, action)
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_role_permissions p
    WHERE p.tenant_id=t.id AND p.role=g.role AND p.module='quality'
      AND p.resource=g.resource AND p.action=g.action
);
