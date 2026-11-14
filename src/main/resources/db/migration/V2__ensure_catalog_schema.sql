-- Repair migration for local databases that were previously baselined at V1.
-- Every operation is safe when V1 has already created the same objects.
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(180) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(24) NOT NULL DEFAULT 'trial',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (id, slug, display_name)
VALUES ('00000000-0000-4000-8000-000000000001', 'northstar-manufacturing', 'Northstar Manufacturing')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(180) NOT NULL,
    email VARCHAR(254) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_customers_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS ix_customers_tenant_name ON customers (tenant_id, name);

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(100) NOT NULL,
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    unit VARCHAR(24) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_items_tenant_sku UNIQUE (tenant_id, sku)
);
CREATE INDEX IF NOT EXISTS ix_items_tenant_name ON items (tenant_id, name);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
    reason VARCHAR(80) NOT NULL,
    source_reference VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_tenant_item_time ON inventory_movements (tenant_id, item_id, created_at);

CREATE OR REPLACE FUNCTION reject_inventory_movement_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Inventory movements are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS inventory_movements_append_only ON inventory_movements;
CREATE TRIGGER inventory_movements_append_only
    BEFORE UPDATE OR DELETE ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();

INSERT INTO customers (id, tenant_id, code, name, email, status) VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','CUS-001','Meridian Industrial Supply','purchasing@meridian.in','Active'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','CUS-002','Apex Machine Works','accounts@apexworks.in','Active'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','CUS-003','Northstar Components','hello@northstar.co.in','Active'),
('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000001','CUS-004','Kaveri Auto Parts','finance@kaveriauto.in','On hold')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO items (id, tenant_id, sku, name, category, on_hand, unit, unit_price) VALUES
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000001','PRD-1001','Hex bolt · M8 × 30mm','Fasteners',2480,'pcs',2.40),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000001','PRD-1002','Stainless steel sheet · 2mm','Raw material',84,'sheets',1840),
('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000001','PRD-1003','Aluminium extrusion · 40mm','Raw material',312,'meters',460),
('00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000001','PRD-1004','Bracket assembly · Type A','Finished goods',0,'pcs',385)
ON CONFLICT (tenant_id, sku) DO NOTHING;

INSERT INTO inventory_movements (id, tenant_id, item_id, quantity_delta, reason, source_reference) VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000201',2480,'Opening balance','OPENING-PRD-1001'),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000202',84,'Opening balance','OPENING-PRD-1002'),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000203',312,'Opening balance','OPENING-PRD-1003')
ON CONFLICT (id) DO NOTHING;
