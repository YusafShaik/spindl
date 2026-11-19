-- ==============================================================================
-- V79__engineering_change_orders.sql
-- Engineering Change Orders (ECO / ECN), Visual BOM Redlines & Governance Sign-Offs
-- ==============================================================================

CREATE TABLE engineering_change_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    eco_number VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    reason TEXT NOT NULL,
    change_severity VARCHAR(24) NOT NULL DEFAULT 'MAJOR', -- 'CRITICAL', 'MAJOR', 'MINOR'
    finished_item_id UUID NOT NULL REFERENCES items(id),
    base_bom_id UUID REFERENCES bills_of_materials(id) ON DELETE SET NULL,
    target_revision VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'UNDER_REVIEW', -- 'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTED', 'REJECTED'
    effective_cutover_date DATE NOT NULL,
    implementation_notes TEXT,
    implemented_bom_id UUID REFERENCES bills_of_materials(id) ON DELETE SET NULL,
    implemented_at TIMESTAMPTZ,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ecos_tenant_number UNIQUE (tenant_id, eco_number)
);

CREATE TABLE eco_bom_diff_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    eco_id UUID NOT NULL REFERENCES engineering_change_orders(id) ON DELETE CASCADE,
    change_type VARCHAR(24) NOT NULL, -- 'ADD', 'REMOVE', 'QUANTITY_CHANGE'
    component_item_id UUID NOT NULL REFERENCES items(id),
    old_quantity INT NOT NULL DEFAULT 0,
    new_quantity INT NOT NULL DEFAULT 0,
    old_scrap_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    new_scrap_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    notes VARCHAR(255)
);

CREATE TABLE eco_sign_offs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    eco_id UUID NOT NULL REFERENCES engineering_change_orders(id) ON DELETE CASCADE,
    department VARCHAR(24) NOT NULL, -- 'ENGINEERING', 'MANUFACTURING', 'QUALITY', 'FINANCE'
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    approver_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    sign_off_role VARCHAR(64),
    comments TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_eco_signoffs_dept UNIQUE (tenant_id, eco_id, department)
);

CREATE INDEX idx_ecos_tenant_status ON engineering_change_orders (tenant_id, status);
CREATE INDEX idx_ecos_finished_item ON engineering_change_orders (tenant_id, finished_item_id);
CREATE INDEX idx_eco_diff_eco_id ON eco_bom_diff_lines (tenant_id, eco_id);
CREATE INDEX idx_eco_sign_offs_eco_id ON eco_sign_offs (tenant_id, eco_id);

-- Seed ECO #1: Approved & Ready for Cutover Implementation
INSERT INTO engineering_change_orders (
    id, tenant_id, eco_number, title, reason, change_severity, finished_item_id,
    base_bom_id, target_revision, status, effective_cutover_date, created_by, created_at
) VALUES (
    '11111111-eeee-4444-aaaa-111111110001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'ECO-202611-001',
    'High-Vibration Impeller Flange Fastener Reinforcement Specification',
    'Dynamic vibration bench analysis revealed micro-shearing at 12,000 RPM. Increase Hex Bolt count from 4 to 6 pcs and introduce titanium mounting ring bracket.',
    'CRITICAL',
    'eab6bea6-8ddd-4dde-9564-2acb2dd12eae', -- CNC-ROTOR-SUB
    'e63734ef-775d-4ceb-88f9-ac0076d669fd', -- CNC-ROTOR-SUB REV-A
    'REV-B',
    'APPROVED',
    CURRENT_DATE + INTERVAL '5 days',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
) ON CONFLICT DO NOTHING;

INSERT INTO eco_bom_diff_lines (
    id, tenant_id, eco_id, change_type, component_item_id, old_quantity, new_quantity,
    old_scrap_percent, new_scrap_percent, notes
) VALUES
(
    '22222222-eeee-4444-aaaa-222222220001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'QUANTITY_CHANGE',
    'a7fea5b7-c66c-4da0-bcaa-b365269e4e72', -- HEX-BOLT-M12
    4,
    6,
    0.00,
    0.00,
    'Reinforce bolting circle torque retention from 4 to 6 points'
),
(
    '22222222-eeee-4444-aaaa-222222220002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'ADD',
    '775db27f-3e36-40d8-91cc-cdeacd0e34fc', -- TI-ROD-025 Titanium Round Bar Grade 5 Dia 25mm
    0,
    1,
    0.00,
    1.50,
    'Machined titanium dampener collar for harmonic oscillation dissipation'
) ON CONFLICT DO NOTHING;

INSERT INTO eco_sign_offs (
    id, tenant_id, eco_id, department, status, approver_user_id, sign_off_role, comments, approved_at
) VALUES
(
    '33333333-eeee-4444-aaaa-333333330001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'ENGINEERING',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'Chief Design Engineer',
    'Finite Element Analysis (FEA) completed; peak stress reduced by 34% at 15,000 RPM.',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
),
(
    '33333333-eeee-4444-aaaa-333333330002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'MANUFACTURING',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'Plant Operations Lead',
    'CNC 5-axis tooling program verified for 6-hole indexing pattern.',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    '33333333-eeee-4444-aaaa-333333330003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'QUALITY',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'ISO-9001 Quality Lead',
    'First article inspection protocol and coordinate measuring machine (CMM) routines updated.',
    CURRENT_TIMESTAMP - INTERVAL '18 hours'
),
(
    '33333333-eeee-4444-aaaa-333333330004',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110001',
    'FINANCE',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'Cost Accounting Lead',
    'Unit BOM cost increases by ₹ 1,297.00. Approved based on aerospace warranty reduction ROI.',
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
) ON CONFLICT DO NOTHING;

-- Seed ECO #2: Under Review
INSERT INTO engineering_change_orders (
    id, tenant_id, eco_number, title, reason, change_severity, finished_item_id,
    base_bom_id, target_revision, status, effective_cutover_date, created_by, created_at
) VALUES (
    '11111111-eeee-4444-aaaa-111111110002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'ECO-202611-002',
    'Intake Valve Seat Material Optimization for High Thermal Cycles',
    'Transitioning to pre-lubricated precision ball bearings to reduce wear during high thermal cycles.',
    'MAJOR',
    '96415ec8-32da-42c1-9c5e-4f313f5ba43f', -- TIT-VLV-300
    'e82e50c3-6de6-4cbe-af2e-799599fde78f', -- TIT-VLV-300 REV-B
    'REV-C',
    'UNDER_REVIEW',
    CURRENT_DATE + INTERVAL '14 days',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
) ON CONFLICT DO NOTHING;

INSERT INTO eco_bom_diff_lines (
    id, tenant_id, eco_id, change_type, component_item_id, old_quantity, new_quantity,
    old_scrap_percent, new_scrap_percent, notes
) VALUES
(
    '22222222-eeee-4444-aaaa-222222220003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110002',
    'ADD',
    '79921470-db16-4850-a35a-cd3b7182762f', -- BRG-6205-2RS
    0,
    1,
    0.00,
    0.00,
    'Precision ball bearing guide collar for axial runout stabilization'
) ON CONFLICT DO NOTHING;

INSERT INTO eco_sign_offs (
    id, tenant_id, eco_id, department, status, approver_user_id, sign_off_role, comments, approved_at
) VALUES
(
    '33333333-eeee-4444-aaaa-333333330005',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110002',
    'ENGINEERING',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'CAD & Simulation Lead',
    'Thermal dissipation models indicate 42 deg C lower peak operating temperature.',
    CURRENT_TIMESTAMP - INTERVAL '12 hours'
),
(
    '33333333-eeee-4444-aaaa-333333330006',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110002',
    'QUALITY',
    'APPROVED',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    'Metrology Specialist',
    'Sample bearings verified on optical comparator.',
    CURRENT_TIMESTAMP - INTERVAL '4 hours'
),
(
    '33333333-eeee-4444-aaaa-333333330007',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110002',
    'MANUFACTURING',
    'PENDING',
    NULL,
    NULL,
    NULL,
    NULL
),
(
    '33333333-eeee-4444-aaaa-333333330008',
    '86346062-7d9c-40e4-be16-2007ab592625',
    '11111111-eeee-4444-aaaa-111111110002',
    'FINANCE',
    'PENDING',
    NULL,
    NULL,
    NULL,
    NULL
) ON CONFLICT DO NOTHING;
