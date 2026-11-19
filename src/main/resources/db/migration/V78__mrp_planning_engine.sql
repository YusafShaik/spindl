-- ==============================================================================
-- V78__mrp_planning_engine.sql
-- Material Requirements Planning (MRP-II) calculation runs and planned orders
-- ==============================================================================

CREATE TABLE mrp_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_number VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'APPLIED', 'ARCHIVED'
    planning_horizon_weeks INT NOT NULL DEFAULT 4,
    total_recommendations INT NOT NULL DEFAULT 0,
    total_planned_spend NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_shortage_units INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_mrp_runs_number UNIQUE (tenant_id, run_number)
);

CREATE TABLE mrp_planned_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mrp_run_id UUID NOT NULL REFERENCES mrp_runs(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    action_type VARCHAR(24) NOT NULL, -- 'PURCHASE_ORDER', 'WORK_ORDER'
    bom_id UUID REFERENCES bills_of_materials(id) ON DELETE SET NULL,
    suggested_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    recommended_quantity INT NOT NULL,
    recommended_order_date DATE NOT NULL,
    required_by_date DATE NOT NULL,
    lead_time_days INT NOT NULL DEFAULT 0,
    estimated_unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    estimated_total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    urgency VARCHAR(24) NOT NULL DEFAULT 'MEDIUM', -- 'CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL'
    demand_source_type VARCHAR(32) NOT NULL, -- 'SALES_ORDER', 'WORK_ORDER_COMPONENT', 'SAFETY_STOCK', 'MULTI_LEVEL_BOM'
    demand_source_ref VARCHAR(120),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CONVERTED', 'DISMISSED'
    converted_entity_id UUID,
    converted_order_number VARCHAR(64),
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mrp_runs_tenant ON mrp_runs (tenant_id, created_at DESC);
CREATE INDEX idx_mrp_planned_orders_tenant_run ON mrp_planned_orders (tenant_id, mrp_run_id);
CREATE INDEX idx_mrp_planned_orders_item ON mrp_planned_orders (tenant_id, item_id);
CREATE INDEX idx_mrp_planned_orders_status ON mrp_planned_orders (tenant_id, status);

-- Seed Initial MRP Calculation Run & Planned Orders for demo tenant '86346062-7d9c-40e4-be16-2007ab592625'
INSERT INTO mrp_runs (
    id, tenant_id, run_number, status, planning_horizon_weeks, total_recommendations,
    total_planned_spend, total_shortage_units, notes, created_by, created_at
) VALUES (
    '88888888-9999-4444-aaaa-bbbbbbbb0001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'MRP-202611-001',
    'COMPLETED',
    4,
    3,
    146000.00,
    115,
    'Automated enterprise demand explosion across active Sales Orders and Safety Stock thresholds.',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
) ON CONFLICT DO NOTHING;

INSERT INTO mrp_planned_orders (
    id, tenant_id, mrp_run_id, item_id, action_type, bom_id, suggested_supplier_id,
    recommended_quantity, recommended_order_date, required_by_date, lead_time_days,
    estimated_unit_cost, estimated_total_cost, urgency, demand_source_type, demand_source_ref,
    status, created_at
) VALUES
(
    '99999999-aaaa-4444-bbbb-cccccccc0001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '88888888-9999-4444-aaaa-bbbbbbbb0001',
    '775db27f-3e36-40d8-91cc-cdeacd0e34fc', -- TI-ROD-025 Titanium Round Bar Grade 5 Dia 25mm
    'PURCHASE_ORDER',
    NULL,
    '11111111-2222-3333-4444-555555555551', -- Apex Tooling & Forgings Ltd
    50,
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '11 days',
    14,
    1200.00,
    60000.00,
    'CRITICAL',
    'SAFETY_STOCK',
    'Below Min Safety Threshold (35 on hand vs 50 min)',
    'PENDING',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    '99999999-aaaa-4444-bbbb-cccccccc0002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '88888888-9999-4444-aaaa-bbbbbbbb0001',
    'ef9e1f35-28f7-440e-9147-04209b64ea46', -- ALU-FLG-200 Machined Aircraft-Grade Aluminum Flange
    'PURCHASE_ORDER',
    NULL,
    '11111111-2222-3333-4444-555555555552', -- Precision Alloys India Pvt Ltd
    40,
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '20 days',
    21,
    1850.00,
    74000.00,
    'HIGH',
    'SALES_ORDER',
    'Demand from SO-2026-FA90535B & SO-2026-AE3B3712',
    'PENDING',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    '99999999-aaaa-4444-bbbb-cccccccc0003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '88888888-9999-4444-aaaa-bbbbbbbb0001',
    'eab6bea6-8ddd-4dde-9564-2acb2dd12eae', -- CNC-ROTOR-SUB
    'WORK_ORDER',
    'e63734ef-775d-4ceb-88f9-ac0076d669fd', -- BOM CNC-ROTOR-SUB REV-A
    NULL,
    25,
    CURRENT_DATE + INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '7 days',
    5,
    480.00,
    12000.00,
    'MEDIUM',
    'MULTI_LEVEL_BOM',
    'Dep. Component for Finished Assembly Buffer',
    'PENDING',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
) ON CONFLICT DO NOTHING;
