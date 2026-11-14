ALTER TABLE work_order_materials ADD COLUMN estimated_unit_cost NUMERIC(14,4);
ALTER TABLE work_order_material_operations ADD COLUMN unit_cost NUMERIC(14,4);
ALTER TABLE work_order_material_operations ADD COLUMN cost_amount NUMERIC(14,2);
ALTER TABLE work_order_materials ADD CONSTRAINT ck_work_order_material_estimated_unit_cost CHECK (estimated_unit_cost IS NULL OR estimated_unit_cost >= 0);
ALTER TABLE work_order_material_operations ADD CONSTRAINT ck_work_order_material_operation_cost CHECK ((unit_cost IS NULL AND cost_amount IS NULL) OR (unit_cost >= 0 AND cost_amount >= 0));
