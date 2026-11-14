CREATE TABLE tenant_role_permissions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    role VARCHAR(24) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
    module VARCHAR(64) NOT NULL,
    resource VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    permission_scope VARCHAR(24) NOT NULL DEFAULT 'ALL' CHECK (permission_scope IN ('OWN', 'TEAM', 'BRANCH', 'ALL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_role_permission UNIQUE (tenant_id, role, module, resource, action, permission_scope)
);
CREATE INDEX ix_tenant_role_permissions_lookup ON tenant_role_permissions(tenant_id, role, module, resource, action);

-- Seed role templates for tenants that already exist when this migration runs.
INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), t.id, g.role, g.module, g.resource, g.action
FROM tenants t
CROSS JOIN (VALUES
    ('OWNER', '*', '*', '*'), ('ADMIN', '*', '*', '*'),
    ('MANAGER', '*', '*', 'view'), ('VIEWER', '*', '*', 'view'), ('OPERATOR', '*', '*', 'view'),
    ('MANAGER', 'crm', '*', 'create'), ('MANAGER', 'crm', '*', 'edit'),
    ('MANAGER', 'catalog', '*', 'create'), ('MANAGER', 'catalog', '*', 'edit'),
    ('MANAGER', 'inventory', '*', 'create'), ('MANAGER', 'inventory', '*', 'edit'), ('MANAGER', 'inventory', '*', 'adjust'),
    ('MANAGER', 'purchasing', '*', 'create'), ('MANAGER', 'purchasing', '*', 'edit'), ('MANAGER', 'purchasing', '*', 'approve'), ('MANAGER', 'purchasing', '*', 'receive'), ('MANAGER', 'purchasing', '*', 'return'),
    ('MANAGER', 'sales', '*', 'create'), ('MANAGER', 'sales', '*', 'edit'), ('MANAGER', 'sales', '*', 'approve'), ('MANAGER', 'sales', '*', 'fulfill'),
    ('MANAGER', 'finance', '*', 'export'), ('MANAGER', 'finance', '*', 'pay'), ('MANAGER', 'finance', '*', 'credit'),
    ('MANAGER', 'imports', '*', 'create'), ('MANAGER', 'imports', '*', 'import'),
    ('OPERATOR', 'crm', '*', 'create'), ('OPERATOR', 'crm', '*', 'edit'),
    ('OPERATOR', 'catalog', '*', 'create'), ('OPERATOR', 'catalog', '*', 'edit'),
    ('OPERATOR', 'inventory', '*', 'create'), ('OPERATOR', 'inventory', '*', 'edit'), ('OPERATOR', 'inventory', '*', 'adjust'),
    ('OPERATOR', 'purchasing', '*', 'create'), ('OPERATOR', 'purchasing', '*', 'edit'),
    ('OPERATOR', 'sales', '*', 'create'), ('OPERATOR', 'sales', '*', 'edit')
) AS g(role, module, resource, action);
