CREATE TABLE tenant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    legal_name VARCHAR(180),
    tax_registration VARCHAR(80),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_branches_tenant_code UNIQUE (tenant_id,code),
    CONSTRAINT uk_tenant_branches_tenant_id UNIQUE (tenant_id,id)
);
CREATE UNIQUE INDEX uk_tenant_branches_one_default ON tenant_branches(tenant_id) WHERE is_default=TRUE;

INSERT INTO tenant_branches(tenant_id,code,name,is_default)
SELECT id,'MAIN',display_name || ' — Main',TRUE FROM tenants;

ALTER TABLE tenant_memberships ADD COLUMN manager_user_id UUID;
ALTER TABLE tenant_memberships ADD CONSTRAINT fk_membership_manager_same_tenant
    FOREIGN KEY (tenant_id,manager_user_id) REFERENCES tenant_memberships(tenant_id,user_id);
ALTER TABLE tenant_memberships ADD CONSTRAINT ck_membership_not_own_manager CHECK (manager_user_id IS NULL OR manager_user_id<>user_id);
CREATE INDEX ix_tenant_memberships_manager ON tenant_memberships(tenant_id,manager_user_id) WHERE active=TRUE;

CREATE TABLE tenant_membership_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    CONSTRAINT fk_member_branch_membership FOREIGN KEY (tenant_id,user_id) REFERENCES tenant_memberships(tenant_id,user_id) ON DELETE CASCADE,
    CONSTRAINT fk_member_branch_branch FOREIGN KEY (tenant_id,branch_id) REFERENCES tenant_branches(tenant_id,id) ON DELETE CASCADE,
    CONSTRAINT uk_member_branch UNIQUE (tenant_id,user_id,branch_id)
);
CREATE INDEX ix_member_branch_lookup ON tenant_membership_branches(tenant_id,branch_id,user_id);

INSERT INTO tenant_membership_branches(tenant_id,user_id,branch_id)
SELECT m.tenant_id,m.user_id,b.id
FROM tenant_memberships m JOIN tenant_branches b ON b.tenant_id=m.tenant_id AND b.is_default=TRUE;

ALTER TABLE warehouses ADD COLUMN branch_id UUID;
UPDATE warehouses w SET branch_id=b.id FROM tenant_branches b WHERE b.tenant_id=w.tenant_id AND b.is_default=TRUE;
ALTER TABLE warehouses ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE warehouses ADD CONSTRAINT fk_warehouse_branch_same_tenant
    FOREIGN KEY (tenant_id,branch_id) REFERENCES tenant_branches(tenant_id,id);
CREATE INDEX ix_warehouses_tenant_branch ON warehouses(tenant_id,branch_id);

ALTER TABLE crm_leads ADD COLUMN branch_id UUID;
UPDATE crm_leads l SET branch_id=b.id FROM tenant_branches b WHERE b.tenant_id=l.tenant_id AND b.is_default=TRUE;
ALTER TABLE crm_leads ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE crm_leads ADD CONSTRAINT fk_crm_lead_branch_same_tenant
    FOREIGN KEY (tenant_id,branch_id) REFERENCES tenant_branches(tenant_id,id);
CREATE INDEX ix_crm_leads_tenant_branch ON crm_leads(tenant_id,branch_id,updated_at DESC);

CREATE FUNCTION create_tenant_default_branch() RETURNS trigger AS $$
BEGIN
    INSERT INTO tenant_branches(tenant_id,code,name,is_default)
    VALUES (NEW.id,'MAIN',NEW.display_name || ' — Main',TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tenants_create_default_branch
    AFTER INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION create_tenant_default_branch();

CREATE OR REPLACE FUNCTION create_tenant_default_warehouse() RETURNS trigger AS $$
DECLARE default_branch_id UUID;
BEGIN
    SELECT id INTO default_branch_id FROM tenant_branches WHERE tenant_id=NEW.id AND is_default=TRUE;
    INSERT INTO warehouses (id,tenant_id,code,name,is_default,active,branch_id)
    VALUES (gen_random_uuid(),NEW.id,'MAIN','Main Warehouse',true,true,default_branch_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
