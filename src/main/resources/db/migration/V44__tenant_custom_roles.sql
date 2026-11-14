ALTER TABLE tenant_role_permissions DROP CONSTRAINT tenant_role_permissions_role_check;
ALTER TABLE tenant_role_permissions ADD CONSTRAINT ck_tenant_role_permissions_role_code
    CHECK (role ~ '^[A-Z][A-Z0-9_]{0,23}$');
ALTER TABLE tenant_memberships DROP CONSTRAINT ck_tenant_memberships_role;
ALTER TABLE tenant_memberships ADD CONSTRAINT ck_tenant_memberships_role_code
    CHECK (role ~ '^[A-Z][A-Z0-9_]{0,23}$');

CREATE TABLE tenant_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_code VARCHAR(24) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    description VARCHAR(240) NOT NULL DEFAULT '',
    system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_role_code UNIQUE(tenant_id,role_code),
    CONSTRAINT ck_tenant_role_code CHECK (role_code ~ '^[A-Z][A-Z0-9_]{0,23}$'),
    CONSTRAINT uk_tenant_role_id UNIQUE(tenant_id,id)
);

INSERT INTO tenant_roles(tenant_id,role_code,display_name,description,system_role)
SELECT t.id,r.code,r.label,'Built-in workspace role',TRUE
FROM tenants t
CROSS JOIN (VALUES ('OWNER','Owner'),('ADMIN','Admin'),('MANAGER','Manager'),('OPERATOR','Operator'),('VIEWER','Viewer')) AS r(code,label);
