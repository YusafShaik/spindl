CREATE TABLE bom_revision_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
    actor_user_id UUID REFERENCES app_users(id),
    event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'APPROVED', 'OBSOLETED')),
    previous_status VARCHAR(16),
    new_status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_bom_revision_events_history ON bom_revision_events(tenant_id, bom_id, created_at DESC);

DELETE FROM tenant_role_permissions WHERE role='OPERATOR' AND module='manufacturing' AND action='edit';
INSERT INTO tenant_role_permissions (id, tenant_id, role, module, resource, action)
SELECT gen_random_uuid(), id, 'OPERATOR', 'manufacturing', 'work-orders', 'edit' FROM tenants;

INSERT INTO bom_revision_events (id, tenant_id, bom_id, event_type, previous_status, new_status, created_at)
SELECT gen_random_uuid(), tenant_id, id, 'CREATED', NULL, 'DRAFT', created_at FROM bills_of_materials;
INSERT INTO bom_revision_events (id, tenant_id, bom_id, event_type, previous_status, new_status, created_at)
SELECT gen_random_uuid(), tenant_id, id, 'APPROVED', 'DRAFT', 'APPROVED', approved_at
FROM bills_of_materials WHERE status IN ('APPROVED', 'OBSOLETE') AND approved_at IS NOT NULL;
INSERT INTO bom_revision_events (id, tenant_id, bom_id, event_type, previous_status, new_status, created_at)
SELECT gen_random_uuid(), tenant_id, id, 'OBSOLETED', 'APPROVED', 'OBSOLETE', now()
FROM bills_of_materials WHERE status = 'OBSOLETE';
