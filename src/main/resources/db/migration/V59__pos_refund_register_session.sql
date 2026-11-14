ALTER TABLE pos_refunds ADD COLUMN session_id UUID NOT NULL;
ALTER TABLE pos_refunds ADD CONSTRAINT fk_pos_refunds_session
    FOREIGN KEY (tenant_id, session_id) REFERENCES pos_register_sessions(tenant_id, id);
CREATE INDEX ix_pos_refunds_tenant_session ON pos_refunds(tenant_id, session_id);
