CREATE TABLE warehouses (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_warehouses_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uk_warehouses_tenant_code UNIQUE (tenant_id, code)
);
CREATE UNIQUE INDEX uk_warehouses_one_default_per_tenant ON warehouses (tenant_id) WHERE is_default;
ALTER TABLE items ADD CONSTRAINT uk_items_tenant_id UNIQUE (tenant_id, id);

INSERT INTO warehouses (id, tenant_id, code, name, is_default, active)
SELECT gen_random_uuid(), id, 'MAIN', 'Main Warehouse', true, true FROM tenants;

CREATE FUNCTION create_tenant_default_warehouse() RETURNS trigger AS $$
BEGIN
    INSERT INTO warehouses (id,tenant_id,code,name,is_default,active)
    VALUES (gen_random_uuid(),NEW.id,'MAIN','Main Warehouse',true,true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tenants_create_default_warehouse
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION create_tenant_default_warehouse();

CREATE TABLE warehouse_stock (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_id UUID NOT NULL,
    item_id UUID NOT NULL,
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_warehouse_stock_warehouse FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id),
    CONSTRAINT fk_warehouse_stock_item FOREIGN KEY (tenant_id, item_id) REFERENCES items(tenant_id, id),
    CONSTRAINT uk_warehouse_stock_tenant_location_item UNIQUE (tenant_id, warehouse_id, item_id)
);
CREATE INDEX ix_warehouse_stock_tenant_item ON warehouse_stock (tenant_id, item_id);

CREATE FUNCTION create_item_warehouse_stock_for_locations() RETURNS trigger AS $$
BEGIN
    INSERT INTO warehouse_stock (id,tenant_id,warehouse_id,item_id,on_hand)
    SELECT gen_random_uuid(),NEW.tenant_id,w.id,NEW.id,0 FROM warehouses w
    WHERE w.tenant_id=NEW.tenant_id AND w.active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant has no active default warehouse';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER items_create_default_warehouse_stock
    AFTER INSERT ON items
    FOR EACH ROW EXECUTE FUNCTION create_item_warehouse_stock_for_locations();

CREATE FUNCTION restore_item_warehouse_stock_for_locations() RETURNS trigger AS $$
BEGIN
    IF NEW.active AND NOT OLD.active THEN
        INSERT INTO warehouse_stock (id,tenant_id,warehouse_id,item_id,on_hand)
        SELECT gen_random_uuid(),NEW.tenant_id,w.id,NEW.id,0 FROM warehouses w
        WHERE w.tenant_id=NEW.tenant_id AND w.active
        ON CONFLICT (tenant_id,warehouse_id,item_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER items_reactivate_warehouse_stock
    AFTER UPDATE OF active ON items
    FOR EACH ROW EXECUTE FUNCTION restore_item_warehouse_stock_for_locations();

INSERT INTO warehouse_stock (id, tenant_id, warehouse_id, item_id, on_hand)
SELECT gen_random_uuid(), i.tenant_id, w.id, i.id, i.on_hand
FROM items i JOIN warehouses w ON w.tenant_id=i.tenant_id AND w.is_default;

ALTER TABLE inventory_movements ADD COLUMN warehouse_id UUID;
ALTER TABLE inventory_movements DISABLE TRIGGER inventory_movements_append_only;
UPDATE inventory_movements m SET warehouse_id=w.id FROM warehouses w WHERE w.tenant_id=m.tenant_id AND w.is_default;
ALTER TABLE inventory_movements ENABLE TRIGGER inventory_movements_append_only;
ALTER TABLE inventory_movements ADD CONSTRAINT fk_inventory_movements_warehouse FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses (tenant_id, id);
ALTER TABLE inventory_movements ALTER COLUMN warehouse_id SET NOT NULL;
CREATE INDEX ix_inventory_movements_tenant_warehouse_time ON inventory_movements (tenant_id, warehouse_id, created_at DESC);

ALTER TABLE inventory_cycle_counts ADD COLUMN warehouse_id UUID;
UPDATE inventory_cycle_counts c SET warehouse_id=w.id FROM warehouses w WHERE w.tenant_id=c.tenant_id AND w.is_default;
ALTER TABLE inventory_cycle_counts ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE inventory_cycle_counts ADD CONSTRAINT fk_inventory_cycle_counts_warehouse FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);

CREATE TABLE inventory_transfers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    item_id UUID NOT NULL,
    source_warehouse_id UUID NOT NULL,
    destination_warehouse_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason VARCHAR(240) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_inventory_transfers_item FOREIGN KEY (tenant_id,item_id) REFERENCES items(tenant_id,id),
    CONSTRAINT fk_inventory_transfers_source FOREIGN KEY (tenant_id,source_warehouse_id) REFERENCES warehouses(tenant_id,id),
    CONSTRAINT fk_inventory_transfers_destination FOREIGN KEY (tenant_id,destination_warehouse_id) REFERENCES warehouses(tenant_id,id),
    CONSTRAINT ck_inventory_transfer_distinct_locations CHECK (source_warehouse_id <> destination_warehouse_id),
    CONSTRAINT uk_inventory_transfers_tenant_idempotency UNIQUE (tenant_id,idempotency_key)
);
CREATE INDEX ix_inventory_transfers_tenant_created ON inventory_transfers (tenant_id,created_at DESC);

CREATE FUNCTION set_and_apply_inventory_warehouse_stock() RETURNS trigger AS $$
BEGIN
    IF NEW.warehouse_id IS NULL THEN
        SELECT id INTO NEW.warehouse_id FROM warehouses WHERE tenant_id=NEW.tenant_id AND is_default AND active;
    END IF;
    IF NEW.warehouse_id IS NULL THEN
        RAISE EXCEPTION 'Tenant has no active default warehouse';
    END IF;
    INSERT INTO warehouse_stock (id, tenant_id, warehouse_id, item_id, on_hand)
    VALUES (gen_random_uuid(), NEW.tenant_id, NEW.warehouse_id, NEW.item_id, NEW.quantity_delta)
    ON CONFLICT (tenant_id, warehouse_id, item_id)
    DO UPDATE SET on_hand=warehouse_stock.on_hand+EXCLUDED.on_hand, updated_at=now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movement_updates_warehouse_stock
    BEFORE INSERT ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION set_and_apply_inventory_warehouse_stock();
