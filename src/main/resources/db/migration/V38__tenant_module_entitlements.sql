CREATE TABLE tenant_module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    module_code VARCHAR(40) NOT NULL CHECK (module_code IN ('dashboard','crm','catalog','inventory','sales','purchasing','manufacturing','quality','finance','imports','team','operations')),
    entitled BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    source_plan VARCHAR(40) NOT NULL DEFAULT 'TRIAL',
    plan_version INTEGER NOT NULL DEFAULT 1 CHECK (plan_version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_module_entitlement UNIQUE (tenant_id,module_code),
    CONSTRAINT ck_enabled_module_is_entitled CHECK (NOT enabled OR entitled)
);
CREATE INDEX ix_tenant_module_entitlements_tenant_enabled ON tenant_module_entitlements(tenant_id,enabled);

INSERT INTO tenant_module_entitlements(tenant_id,module_code)
SELECT t.id,m.module_code
FROM tenants t
CROSS JOIN (VALUES ('dashboard'),('crm'),('catalog'),('inventory'),('sales'),('purchasing'),('manufacturing'),('quality'),('finance'),('imports'),('team'),('operations')) AS m(module_code)
ON CONFLICT(tenant_id,module_code) DO NOTHING;
