-- V76__maintenance_cmms.sql
-- Equipment Reliability & Maintenance Management (CMMS)

CREATE TABLE maintenance_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL,
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    status VARCHAR(24) NOT NULL DEFAULT 'OPERATIONAL' CHECK (status IN ('OPERATIONAL','UNDER_MAINTENANCE','DECOMMISSIONED')),
    meter_hours NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    installation_date DATE,
    warranty_expiry DATE,
    last_service_date DATE,
    next_service_due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_maintenance_assets_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uk_maintenance_assets_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX ix_maintenance_assets_tenant ON maintenance_assets(tenant_id, status);

CREATE TABLE maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES maintenance_assets(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    frequency_type VARCHAR(20) NOT NULL CHECK (frequency_type IN ('CALENDAR_DAYS','METER_HOURS')),
    frequency_interval INT NOT NULL,
    last_performed_at TIMESTAMPTZ,
    next_due_date DATE,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_maintenance_schedules_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX ix_maintenance_schedules_tenant ON maintenance_schedules(tenant_id, asset_id, active);

CREATE TABLE maintenance_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number VARCHAR(60) NOT NULL,
    asset_id UUID NOT NULL REFERENCES maintenance_assets(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PREVENTIVE','BREAKDOWN')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
    assigned_technician_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    failure_symptom TEXT,
    root_cause TEXT,
    resolution_notes TEXT,
    downtime_minutes INT NOT NULL DEFAULT 0,
    scheduled_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_maintenance_wo_tenant_number UNIQUE (tenant_id, order_number),
    CONSTRAINT uk_maintenance_wo_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX ix_maintenance_wo_tenant_status ON maintenance_work_orders(tenant_id, status, priority);

CREATE TABLE maintenance_parts_consumed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES maintenance_work_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_maintenance_parts_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX ix_maintenance_parts_tenant_wo ON maintenance_parts_consumed(tenant_id, work_order_id);

-- Seed initial equipment assets and sample maintenance records for existing tenants
INSERT INTO maintenance_assets (id, tenant_id, code, name, work_center_id, serial_number, manufacturer, model, status, meter_hours, installation_date, warranty_expiry, last_service_date, next_service_due_date, notes)
SELECT 
    'a1000000-0000-4000-8000-000000000001'::uuid,
    wc.tenant_id,
    'EQ-CNC-01',
    'Haas VF-4SS Super-Speed 5-Axis VMC',
    wc.id,
    'SN-HAAS-884920',
    'Haas Automation',
    'VF-4SS 12K RPM',
    'OPERATIONAL',
    1480.50,
    '2024-03-15',
    '2027-03-15',
    CURRENT_DATE - INTERVAL '25 days',
    CURRENT_DATE + INTERVAL '5 days',
    'Critical 5-axis milling machine used for turbine impeller sub-assemblies. Requires ISO VG 68 spindle lubricant.'
FROM work_centers wc
WHERE wc.code = 'CNC-01'
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_assets (id, tenant_id, code, name, work_center_id, serial_number, manufacturer, model, status, meter_hours, installation_date, warranty_expiry, last_service_date, next_service_due_date, notes)
SELECT 
    'a1000000-0000-4000-8000-000000000002'::uuid,
    wc.tenant_id,
    'EQ-FURN-01',
    'Ipsen TurboTreater Vacuum Heat Furnace',
    wc.id,
    'SN-IPSEN-551024',
    'Ipsen International',
    'TT-1200C Multi-Chamber',
    'OPERATIONAL',
    2340.00,
    '2023-08-20',
    '2026-08-20',
    CURRENT_DATE - INTERVAL '40 days',
    CURRENT_DATE + INTERVAL '20 days',
    'High-temp vacuum solution annealing chamber. Ceramic heating elements and vacuum seals inspection schedule.'
FROM work_centers wc
WHERE wc.code = 'HEAT-01'
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_assets (id, tenant_id, code, name, work_center_id, serial_number, manufacturer, model, status, meter_hours, installation_date, warranty_expiry, last_service_date, next_service_due_date, notes)
SELECT 
    'a1000000-0000-4000-8000-000000000003'::uuid,
    wc.tenant_id,
    'EQ-BENCH-01',
    'Mitutoyo Crysta-Apex V574 CNC CMM & Bench',
    wc.id,
    'SN-MITU-992301',
    'Mitutoyo Corporation',
    'Crysta-Apex V574',
    'OPERATIONAL',
    890.20,
    '2024-01-10',
    '2027-01-10',
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '45 days',
    'Coordinate Measuring Machine and automated dynamic balancing bench with Renishaw SP25M scanning probe.'
FROM work_centers wc
WHERE wc.code = 'ASSY-01'
ON CONFLICT DO NOTHING;

-- Seed Sample Preventive Maintenance Schedules
INSERT INTO maintenance_schedules (id, tenant_id, asset_id, title, frequency_type, frequency_interval, next_due_date, checklist, active)
SELECT
    'b1000000-0000-4000-8000-000000000001'::uuid,
    ma.tenant_id,
    ma.id,
    'CNC Spindle Lubrication & Renishaw Tool Probe Calibration',
    'CALENDAR_DAYS',
    30,
    CURRENT_DATE + INTERVAL '5 days',
    '[{"step": "Check spindle chiller coolant level and conductivity", "done": false}, {"step": "Inspect tool-release piston air pressure (90 PSI)", "done": false}, {"step": "Recalibrate Renishaw optical work probe with master sphere", "done": false}, {"step": "Clean telescoping way-cover wipers and grease guideways", "done": false}]'::jsonb,
    TRUE
FROM maintenance_assets ma
WHERE ma.code = 'EQ-CNC-01'
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_schedules (id, tenant_id, asset_id, title, frequency_type, frequency_interval, next_due_date, checklist, active)
SELECT
    'b1000000-0000-4000-8000-000000000002'::uuid,
    ma.tenant_id,
    ma.id,
    'Vacuum Furnace Thermal Uniformity & Seal Integrity Test',
    'CALENDAR_DAYS',
    60,
    CURRENT_DATE + INTERVAL '20 days',
    '[{"step": "Perform Helium mass spectrometer leak check on main door seal", "done": false}, {"step": "Inspect molybdenum heating elements for deformation or thinning", "done": false}, {"step": "Verify Type-S thermocouple calibration against certified reference", "done": false}]'::jsonb,
    TRUE
FROM maintenance_assets ma
WHERE ma.code = 'EQ-FURN-01'
ON CONFLICT DO NOTHING;

-- Seed Sample Work Orders
INSERT INTO maintenance_work_orders (id, tenant_id, order_number, asset_id, schedule_id, type, priority, status, assigned_technician_user_id, failure_symptom, root_cause, resolution_notes, downtime_minutes, scheduled_date, started_at, completed_at)
SELECT
    'c1000000-0000-4000-8000-000000000001'::uuid,
    ma.tenant_id,
    'MWO-20261118-001',
    ma.id,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'PREVENTIVE',
    'MEDIUM',
    'OPEN',
    u.id,
    'Scheduled 30-day spindle and chiller maintenance inspection',
    NULL,
    NULL,
    0,
    CURRENT_DATE + INTERVAL '5 days',
    NULL,
    NULL
FROM maintenance_assets ma
CROSS JOIN (SELECT id FROM app_users LIMIT 1) u
WHERE ma.code = 'EQ-CNC-01'
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_work_orders (id, tenant_id, order_number, asset_id, type, priority, status, assigned_technician_user_id, failure_symptom, root_cause, resolution_notes, downtime_minutes, scheduled_date, started_at, completed_at)
SELECT
    'c1000000-0000-4000-8000-000000000002'::uuid,
    ma.tenant_id,
    'MWO-20261116-002',
    ma.id,
    'BREAKDOWN',
    'HIGH',
    'COMPLETED',
    u.id,
    'Excessive vibration alarm (Z-axis ball screw rumble) during rapid traverse',
    'Thrust bearing outer race micro-pitting caused by particulate ingress in front seal',
    'Replaced front thrust bearing assembly with BRG-6205-2RS, re-torqued pre-load locknut to 45 Nm, and flushed grease lines. Vibration telemetry returned to baseline 0.4 mm/s RMS.',
    95,
    CURRENT_DATE - INTERVAL '2 days',
    now() - INTERVAL '2 days 4 hours',
    now() - INTERVAL '2 days 2 hours 25 minutes'
FROM maintenance_assets ma
CROSS JOIN (SELECT id FROM app_users LIMIT 1) u
WHERE ma.code = 'EQ-CNC-01'
ON CONFLICT DO NOTHING;

-- Seed Sample Parts Consumption on the Completed Breakdown Order
INSERT INTO maintenance_parts_consumed (id, tenant_id, work_order_id, item_id, warehouse_id, quantity, unit_cost)
SELECT
    'd1000000-0000-4000-8000-000000000001'::uuid,
    mwo.tenant_id,
    mwo.id,
    item.id,
    wh.id,
    2.00,
    380.00
FROM maintenance_work_orders mwo
JOIN items item ON item.sku = 'BRG-6205-2RS' AND item.tenant_id = mwo.tenant_id
JOIN warehouses wh ON wh.code = 'MAIN' AND wh.tenant_id = mwo.tenant_id
WHERE mwo.order_number = 'MWO-20261116-002'
ON CONFLICT DO NOTHING;
