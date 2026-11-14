ALTER TABLE items ADD COLUMN manufacturing_reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (manufacturing_reserved_quantity >= 0);

CREATE TABLE bills_of_materials (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    finished_item_id UUID NOT NULL REFERENCES items(id),
    revision VARCHAR(24) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'OBSOLETE')),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_bom_tenant_finished_revision UNIQUE (tenant_id, finished_item_id, revision),
    CONSTRAINT ck_bom_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX ix_bom_tenant_finished_status ON bills_of_materials(tenant_id, finished_item_id, status, effective_from);

CREATE TABLE bom_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
    component_item_id UUID NOT NULL REFERENCES items(id),
    quantity_per_unit INTEGER NOT NULL CHECK (quantity_per_unit > 0),
    scrap_allowance_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (scrap_allowance_percent >= 0 AND scrap_allowance_percent <= 100),
    CONSTRAINT uk_bom_component UNIQUE (bom_id, component_item_id)
);

CREATE TABLE work_orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
    finished_item_id UUID NOT NULL REFERENCES items(id),
    target_quantity INTEGER NOT NULL CHECK (target_quantity > 0),
    good_quantity INTEGER NOT NULL DEFAULT 0 CHECK (good_quantity >= 0),
    scrap_quantity INTEGER NOT NULL DEFAULT 0 CHECK (scrap_quantity >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CLOSED', 'CANCELLED')),
    planned_start DATE,
    due_date DATE,
    priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_work_orders_number UNIQUE (tenant_id, order_number),
    CONSTRAINT uk_work_orders_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_work_orders_tenant_status ON work_orders(tenant_id, status, created_at DESC);

CREATE TABLE work_order_materials (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    component_item_id UUID NOT NULL REFERENCES items(id),
    quantity_per_unit INTEGER NOT NULL,
    scrap_allowance_percent NUMERIC(5,2) NOT NULL,
    required_quantity INTEGER NOT NULL CHECK (required_quantity > 0),
    issued_quantity INTEGER NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0),
    returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    CONSTRAINT uk_work_order_material UNIQUE (work_order_id, component_item_id)
);

CREATE TABLE work_order_outputs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    good_quantity INTEGER NOT NULL CHECK (good_quantity >= 0),
    scrap_quantity INTEGER NOT NULL CHECK (scrap_quantity >= 0),
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_work_order_output_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE work_order_material_operations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    material_line_id UUID NOT NULL REFERENCES work_order_materials(id),
    operation VARCHAR(16) NOT NULL CHECK (operation IN ('ISSUE', 'RETURN')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_wo_material_operation_key UNIQUE (tenant_id, idempotency_key)
);

INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), t.id, g.role, 'manufacturing', '*', g.action
FROM tenants t
CROSS JOIN (VALUES
    ('MANAGER','view'),('MANAGER','create'),('MANAGER','edit'),('MANAGER','approve'),('MANAGER','release'),('MANAGER','issue'),('MANAGER','return'),('MANAGER','receive'),('MANAGER','export'),
    ('OPERATOR','view'),('OPERATOR','edit'),('OPERATOR','issue'),('OPERATOR','return'),('OPERATOR','receive')
) AS g(role, action);
