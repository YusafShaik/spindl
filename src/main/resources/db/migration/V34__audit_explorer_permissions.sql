CREATE INDEX ix_tenant_audit_events_tenant_type_time ON tenant_audit_events(tenant_id,event_type,created_at DESC);
CREATE INDEX ix_tenant_audit_events_tenant_subject_time ON tenant_audit_events(tenant_id,subject_type,created_at DESC);

INSERT INTO tenant_role_permissions (id,tenant_id,role,module,resource,action)
SELECT gen_random_uuid(),t.id,'MANAGER','operations','audit','view'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_role_permissions p
    WHERE p.tenant_id=t.id AND p.role='MANAGER' AND p.module='operations' AND p.resource='audit' AND p.action='view'
);
