ALTER TABLE warehouse_stock
    ADD COLUMN quality_hold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (quality_hold_quantity >= 0);

ALTER TABLE quality_lots ADD COLUMN warehouse_id UUID;
UPDATE quality_lots q SET warehouse_id=w.id FROM warehouses w WHERE w.tenant_id=q.tenant_id AND w.is_default;
ALTER TABLE quality_lots ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE quality_lots ADD CONSTRAINT fk_quality_lots_warehouse FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);

UPDATE warehouse_stock ws SET quality_hold_quantity=holds.held
FROM (
    SELECT q.tenant_id,q.item_id,q.warehouse_id,sum(q.remaining_quantity)::integer AS held
    FROM quality_lots q GROUP BY q.tenant_id,q.item_id,q.warehouse_id
) holds
WHERE ws.tenant_id=holds.tenant_id AND ws.item_id=holds.item_id AND ws.warehouse_id=holds.warehouse_id;

ALTER TABLE goods_receipt_lines ADD COLUMN warehouse_id UUID;
UPDATE goods_receipt_lines gl SET warehouse_id=w.id FROM goods_receipts gr JOIN warehouses w ON w.tenant_id=gr.tenant_id AND w.is_default WHERE gr.id=gl.goods_receipt_id;
ALTER TABLE goods_receipt_lines ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE goods_receipt_lines ADD CONSTRAINT fk_goods_receipt_lines_warehouse FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id);
