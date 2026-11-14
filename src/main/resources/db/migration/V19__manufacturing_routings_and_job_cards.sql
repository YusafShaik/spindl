CREATE TABLE work_centers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_work_center_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE bom_operations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    name VARCHAR(120) NOT NULL,
    work_center_id UUID NOT NULL REFERENCES work_centers(id),
    setup_minutes INTEGER NOT NULL DEFAULT 0 CHECK (setup_minutes >= 0),
    run_minutes_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (run_minutes_per_unit >= 0),
    skill_requirements VARCHAR(240),
    CONSTRAINT uk_bom_operation_sequence UNIQUE (bom_id, sequence)
);

CREATE TABLE work_order_operations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    name VARCHAR(120) NOT NULL,
    work_center_id UUID NOT NULL REFERENCES work_centers(id),
    work_center_code VARCHAR(40) NOT NULL,
    work_center_name VARCHAR(120) NOT NULL,
    setup_minutes INTEGER NOT NULL DEFAULT 0,
    run_minutes_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
    skill_requirements VARCHAR(240),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    operator_user_id UUID REFERENCES app_users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_setup_minutes INTEGER,
    actual_run_minutes INTEGER,
    produced_quantity INTEGER NOT NULL DEFAULT 0,
    scrap_quantity INTEGER NOT NULL DEFAULT 0,
    downtime_minutes INTEGER NOT NULL DEFAULT 0,
    downtime_reason VARCHAR(240),
    completion_key VARCHAR(120),
    CONSTRAINT uk_work_order_operation_sequence UNIQUE (work_order_id, sequence),
    CONSTRAINT uk_work_order_operation_completion UNIQUE (tenant_id, completion_key)
);
CREATE INDEX ix_work_order_operations_queue ON work_order_operations(tenant_id, work_center_id, status, sequence);

INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), t.id, g.role, 'manufacturing', g.resource, g.action
FROM tenants t
CROSS JOIN (VALUES
    ('MANAGER','*','start'),('MANAGER','*','complete'),
    ('OPERATOR','work-orders','start'),('OPERATOR','work-orders','complete')
) AS g(role, resource, action);
