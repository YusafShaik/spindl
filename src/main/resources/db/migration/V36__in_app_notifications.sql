ALTER TABLE tenant_audit_events
    ADD CONSTRAINT uk_tenant_audit_events_tenant_id UNIQUE (tenant_id,id);

CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    audit_event_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    CONSTRAINT fk_user_notifications_membership FOREIGN KEY (tenant_id,user_id)
        REFERENCES tenant_memberships(tenant_id,user_id),
    CONSTRAINT fk_user_notifications_event FOREIGN KEY (tenant_id,audit_event_id)
        REFERENCES tenant_audit_events(tenant_id,id),
    CONSTRAINT uk_user_notifications_audit_recipient UNIQUE (tenant_id,user_id,audit_event_id)
);
CREATE INDEX ix_user_notifications_inbox ON user_notifications(tenant_id,user_id,read_at,created_at DESC);

CREATE FUNCTION create_audit_notifications() RETURNS trigger AS $$
BEGIN
    INSERT INTO user_notifications(tenant_id,user_id,audit_event_id)
    SELECT NEW.tenant_id,m.user_id,NEW.id
    FROM tenant_memberships m
    WHERE m.tenant_id=NEW.tenant_id AND m.active
      AND (NEW.actor_user_id IS NULL OR m.user_id<>NEW.actor_user_id)
    ON CONFLICT (tenant_id,user_id,audit_event_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_audit_events_create_notifications
    AFTER INSERT ON tenant_audit_events
    FOR EACH ROW EXECUTE FUNCTION create_audit_notifications();

INSERT INTO tenant_role_permissions (id,tenant_id,role,module,resource,action)
SELECT gen_random_uuid(),t.id,r.role,'operations','notifications',a.action
FROM tenants t
CROSS JOIN (VALUES ('OWNER'),('ADMIN'),('MANAGER'),('OPERATOR'),('VIEWER')) AS r(role)
CROSS JOIN (VALUES ('view'),('edit')) AS a(action)
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_role_permissions p
    WHERE p.tenant_id=t.id AND p.role=r.role AND p.module='operations'
      AND p.resource='notifications' AND p.action=a.action AND p.permission_scope='ALL'
);
