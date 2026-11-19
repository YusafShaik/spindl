-- V81: Workforce Management & Operator Skills Matrix

CREATE TABLE IF NOT EXISTS workforce_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    skill_code VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(64) NOT NULL, -- MACHINING, WELDING_JOINING, INSPECTION_METROLOGY, HEAT_TREATMENT, ASSEMBLY
    description VARCHAR(255),
    min_cert_hours INT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_workforce_skills_tenant_code UNIQUE (tenant_id, skill_code)
);

CREATE INDEX IF NOT EXISTS ix_workforce_skills_tenant_cat ON workforce_skills (tenant_id, category);

CREATE TABLE IF NOT EXISTS workforce_operator_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES workforce_skills(id) ON DELETE CASCADE,
    qualification_level VARCHAR(24) NOT NULL, -- APPRENTICE, OPERATOR, SPECIALIST, MASTER
    certified_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_at DATE,
    certified_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PROBATION, EXPIRED, SUSPENDED
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_workforce_op_qual UNIQUE (tenant_id, user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS ix_workforce_op_qual_tenant_user ON workforce_operator_qualifications (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS ix_workforce_op_qual_tenant_skill ON workforce_operator_qualifications (tenant_id, skill_id);

CREATE TABLE IF NOT EXISTS workforce_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_code VARCHAR(32) NOT NULL,
    name VARCHAR(80) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT NOT NULL DEFAULT 45,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_workforce_shifts_tenant_code UNIQUE (tenant_id, shift_code)
);

CREATE TABLE IF NOT EXISTS workforce_roster_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES workforce_shifts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL,
    roster_date DATE NOT NULL,
    planned_hours NUMERIC(4,2) NOT NULL DEFAULT 8.00,
    attendance_status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, PRESENT, LATE, ABSENT, ON_LEAVE
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    actual_hours NUMERIC(4,2),
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_workforce_roster_user_date UNIQUE (tenant_id, user_id, roster_date)
);

CREATE INDEX IF NOT EXISTS ix_workforce_roster_tenant_date ON workforce_roster_assignments (tenant_id, roster_date);
CREATE INDEX IF NOT EXISTS ix_workforce_roster_tenant_user ON workforce_roster_assignments (tenant_id, user_id);

-- Seed skills, shifts, qualifications, and rosters for Soof tenant
DO $$
DECLARE
    t_id UUID := '86346062-7d9c-40e4-be16-2007ab592625'::uuid;
    u_elena UUID := '33333333-3333-4000-8000-333333333333'::uuid;
    u_chloe UUID := '55555555-5555-4000-8000-555555555555'::uuid;
    u_marcus UUID := '22222222-2222-4000-8000-222222222222'::uuid;
    u_devon UUID := '44444444-4444-4000-8000-444444444444'::uuid;
    u_yusaf UUID := 'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a'::uuid;

    s_cnc UUID := gen_random_uuid();
    s_tig UUID := gen_random_uuid();
    s_cmm UUID := gen_random_uuid();
    s_heat UUID := gen_random_uuid();
    s_assy UUID := gen_random_uuid();

    shift_morn UUID := gen_random_uuid();
    shift_eve UUID := gen_random_uuid();
    shift_night UUID := gen_random_uuid();

    wc_cnc UUID;
    wc_assy UUID;
    wc_heat UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants WHERE id = t_id) THEN
        -- 1. Skills
        INSERT INTO workforce_skills (id, tenant_id, skill_code, name, category, description, min_cert_hours)
        VALUES
            (s_cnc, t_id, 'CNC-MILL-5AXIS', '5-Axis CNC Milling & Tool Setting', 'MACHINING', 'Operation, fixture offset probing, and CAM toolpath verification', 120),
            (s_tig, t_id, 'TIG-WELD-AERO', 'GTAW/TIG Aerospace Alloy Fusion', 'WELDING_JOINING', 'Inert gas welding of titanium, inconel, and SS316 aerospace joints', 160),
            (s_cmm, t_id, 'CMM-METROLOGY', 'Zeiss CMM Metrology & GD&T Inspection', 'INSPECTION_METROLOGY', 'Coordinate measuring machine calibration, point clouds, and AS9102 FAI', 80),
            (s_heat, t_id, 'VAC-HEAT-TREAT', 'Thermal Vacuum Furnace & Pyrometry', 'HEAT_TREATMENT', 'AMS 2750 pyrometry, quench cycles, and precipitation aging', 90),
            (s_assy, t_id, 'ASSY-PRECISION', 'Cleanroom Actuator & Hydraulic Assembly', 'ASSEMBLY', 'Micron-tolerance spool fitting, torque angle verification, cleanroom protocols', 60)
        ON CONFLICT (tenant_id, skill_code) DO NOTHING;

        -- 2. Shifts
        INSERT INTO workforce_shifts (id, tenant_id, shift_code, name, start_time, end_time, break_minutes)
        VALUES
            (shift_morn, t_id, 'SHIFT-MORN', 'Morning Alpha Shift', '06:00:00', '14:30:00', 45),
            (shift_eve, t_id, 'SHIFT-EVE', 'Evening Bravo Shift', '14:00:00', '22:30:00', 45),
            (shift_night, t_id, 'SHIFT-NIGHT', 'Night Continuous Shift', '22:00:00', '06:30:00', 45)
        ON CONFLICT (tenant_id, shift_code) DO NOTHING;

        -- Resolve IDs
        SELECT id INTO s_cnc FROM workforce_skills WHERE tenant_id = t_id AND skill_code = 'CNC-MILL-5AXIS';
        SELECT id INTO s_tig FROM workforce_skills WHERE tenant_id = t_id AND skill_code = 'TIG-WELD-AERO';
        SELECT id INTO s_cmm FROM workforce_skills WHERE tenant_id = t_id AND skill_code = 'CMM-METROLOGY';
        SELECT id INTO s_heat FROM workforce_skills WHERE tenant_id = t_id AND skill_code = 'VAC-HEAT-TREAT';
        SELECT id INTO s_assy FROM workforce_skills WHERE tenant_id = t_id AND skill_code = 'ASSY-PRECISION';

        SELECT id INTO shift_morn FROM workforce_shifts WHERE tenant_id = t_id AND shift_code = 'SHIFT-MORN';
        SELECT id INTO shift_eve FROM workforce_shifts WHERE tenant_id = t_id AND shift_code = 'SHIFT-EVE';
        SELECT id INTO shift_night FROM workforce_shifts WHERE tenant_id = t_id AND shift_code = 'SHIFT-NIGHT';

        SELECT id INTO wc_cnc FROM work_centers WHERE tenant_id = t_id AND code = 'CNC-01';
        SELECT id INTO wc_assy FROM work_centers WHERE tenant_id = t_id AND code = 'ASSY-01';
        SELECT id INTO wc_heat FROM work_centers WHERE tenant_id = t_id AND code = 'HEAT-01';

        -- 3. Operator Qualifications Matrix
        -- Elena: CNC Specialist, Assembly Master, CMM Operator
        INSERT INTO workforce_operator_qualifications (tenant_id, user_id, skill_id, qualification_level, certified_at, expires_at, certified_by_user_id, status, notes)
        VALUES
            (t_id, u_elena, s_cnc, 'SPECIALIST', CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE + INTERVAL '185 days', u_yusaf, 'ACTIVE', 'Certified on Haas VF-2 and DMG Mori 5-axis mill'),
            (t_id, u_elena, s_assy, 'MASTER', CURRENT_DATE - INTERVAL '360 days', CURRENT_DATE + INTERVAL '370 days', u_yusaf, 'ACTIVE', 'Lead mechanical assembler with ISO cleanroom cert'),
            (t_id, u_elena, s_cmm, 'OPERATOR', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '275 days', u_yusaf, 'ACTIVE', 'Calypso 2024 software qualified')
        ON CONFLICT (tenant_id, user_id, skill_id) DO NOTHING;

        -- Chloe: TIG Master, Vacuum Heat Specialist, Assembly Operator
        INSERT INTO workforce_operator_qualifications (tenant_id, user_id, skill_id, qualification_level, certified_at, expires_at, certified_by_user_id, status, notes)
        VALUES
            (t_id, u_chloe, s_tig, 'MASTER', CURRENT_DATE - INTERVAL '400 days', CURRENT_DATE + INTERVAL '330 days', u_yusaf, 'ACTIVE', 'ASME Section IX Aerospace GTAW certified'),
            (t_id, u_chloe, s_heat, 'SPECIALIST', CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE + INTERVAL '215 days', u_yusaf, 'ACTIVE', 'AMS 2750 pyrometry calibration compliance'),
            (t_id, u_chloe, s_assy, 'OPERATOR', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days', u_yusaf, 'ACTIVE', 'Hydraulic actuator bench assembly')
        ON CONFLICT (tenant_id, user_id, skill_id) DO NOTHING;

        -- Marcus: CMM Master, CNC Operator
        INSERT INTO workforce_operator_qualifications (tenant_id, user_id, skill_id, qualification_level, certified_at, expires_at, certified_by_user_id, status, notes)
        VALUES
            (t_id, u_marcus, s_cmm, 'MASTER', CURRENT_DATE - INTERVAL '500 days', CURRENT_DATE + INTERVAL '230 days', u_yusaf, 'ACTIVE', 'Chief Quality Metrologist; Level 3 GD&T expert'),
            (t_id, u_marcus, s_cnc, 'OPERATOR', CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '245 days', u_yusaf, 'ACTIVE', '3-axis mill setup and fixture clamping')
        ON CONFLICT (tenant_id, user_id, skill_id) DO NOTHING;

        -- Devon: Assembly Apprentice, CNC Apprentice
        INSERT INTO workforce_operator_qualifications (tenant_id, user_id, skill_id, qualification_level, certified_at, expires_at, certified_by_user_id, status, notes)
        VALUES
            (t_id, u_devon, s_assy, 'APPRENTICE', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', u_yusaf, 'ACTIVE', 'Junior mechanical assembly trainee'),
            (t_id, u_devon, s_cnc, 'APPRENTICE', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '350 days', u_yusaf, 'PROBATION', 'Supervised basic tool setting in progress')
        ON CONFLICT (tenant_id, user_id, skill_id) DO NOTHING;

        -- 4. Rosters (Today's active shifts & scheduled operators)
        INSERT INTO workforce_roster_assignments (tenant_id, shift_id, user_id, work_center_id, roster_date, planned_hours, attendance_status, clock_in_time, actual_hours, notes)
        VALUES
            (t_id, shift_morn, u_elena, wc_cnc, CURRENT_DATE, 8.00, 'PRESENT', now() - INTERVAL '3 hours', 3.00, 'Assigned to CNC Mill Job Card WO-49B00E'),
            (t_id, shift_morn, u_chloe, wc_heat, CURRENT_DATE, 8.00, 'PRESENT', now() - INTERVAL '2 hours 50 minutes', 2.80, 'Vacuum Furnace cycle heat-treat run'),
            (t_id, shift_morn, u_devon, wc_assy, CURRENT_DATE, 8.00, 'PRESENT', now() - INTERVAL '3 hours 10 minutes', 3.10, 'Sub-assembly bracket prep'),
            (t_id, shift_eve, u_marcus, wc_assy, CURRENT_DATE, 8.00, 'SCHEDULED', NULL, NULL, 'Evening Quality First Article Inspection')
        ON CONFLICT (tenant_id, user_id, roster_date) DO NOTHING;

    END IF;
END $$;
