-- V82__maintenance_contractors_and_costing.sql
-- Support outside/external technicians, external non-stock spare parts, and comprehensive maintenance cost accounting

ALTER TABLE maintenance_work_orders
    ADD COLUMN IF NOT EXISTS technician_type VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN IF NOT EXISTS external_contractor_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS external_invoice_ref VARCHAR(100),
    ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE maintenance_parts_consumed
    ALTER COLUMN item_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS part_source VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN IF NOT EXISTS external_part_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_part_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS invoice_reference VARCHAR(100);

ALTER TABLE maintenance_assets
    ADD COLUMN IF NOT EXISTS total_maintenance_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00;
