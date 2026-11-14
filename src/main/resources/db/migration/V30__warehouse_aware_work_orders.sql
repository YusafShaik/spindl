ALTER TABLE warehouse_stock ADD COLUMN manufacturing_reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (manufacturing_reserved_quantity >= 0);

ALTER TABLE work_orders ADD COLUMN output_warehouse_id UUID;
UPDATE work_orders wo SET output_warehouse_id=w.id FROM warehouses w WHERE w.tenant_id=wo.tenant_id AND w.is_default;
ALTER TABLE work_orders ALTER COLUMN output_warehouse_id SET NOT NULL;
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_output_warehouse FOREIGN KEY (tenant_id,output_warehouse_id) REFERENCES warehouses(tenant_id,id);

ALTER TABLE work_order_materials ADD COLUMN warehouse_id UUID;
UPDATE work_order_materials wom SET warehouse_id=w.id FROM warehouses w WHERE w.tenant_id=wom.tenant_id AND w.is_default;
ALTER TABLE work_order_materials ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE work_order_materials ADD CONSTRAINT fk_work_order_materials_warehouse FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);

UPDATE warehouse_stock ws SET manufacturing_reserved_quantity=reservations.reserved
FROM (
    SELECT wom.tenant_id,wom.warehouse_id,wom.component_item_id,sum(greatest(0,wom.required_quantity-wom.issued_quantity))::integer AS reserved
    FROM work_order_materials wom JOIN work_orders wo ON wo.id=wom.work_order_id
    WHERE wo.status IN ('RELEASED','IN_PROGRESS','PAUSED') AND wom.required_quantity>wom.issued_quantity
    GROUP BY wom.tenant_id,wom.warehouse_id,wom.component_item_id
) reservations
WHERE ws.tenant_id=reservations.tenant_id AND ws.warehouse_id=reservations.warehouse_id AND ws.item_id=reservations.component_item_id;
