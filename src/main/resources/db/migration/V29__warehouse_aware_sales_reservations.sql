ALTER TABLE sales_order_lines ADD COLUMN warehouse_id UUID;
UPDATE sales_order_lines sol SET warehouse_id=w.id
FROM sales_orders so
JOIN warehouses w ON w.tenant_id=so.tenant_id AND w.is_default
WHERE so.id=sol.sales_order_id;
ALTER TABLE sales_order_lines ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE sales_order_lines ADD CONSTRAINT fk_sales_order_lines_warehouse
    FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);

ALTER TABLE warehouse_stock ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
UPDATE warehouse_stock ws SET reserved_quantity=reservations.reserved
FROM (
    SELECT tenant_id,warehouse_id,item_id,sum(reserved_quantity)::integer AS reserved
    FROM sales_order_lines WHERE reserved_quantity>0 GROUP BY tenant_id,warehouse_id,item_id
) reservations
WHERE ws.tenant_id=reservations.tenant_id AND ws.warehouse_id=reservations.warehouse_id AND ws.item_id=reservations.item_id;

ALTER TABLE sales_shipment_lines ADD COLUMN warehouse_id UUID;
UPDATE sales_shipment_lines ssl SET warehouse_id=sol.warehouse_id
FROM sales_order_lines sol WHERE sol.id=ssl.sales_order_line_id;
ALTER TABLE sales_shipment_lines ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE sales_shipment_lines ADD CONSTRAINT fk_sales_shipment_lines_warehouse
    FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);
