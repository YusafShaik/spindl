CREATE TABLE tenant_plan_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    current_plan_code VARCHAR(40) NOT NULL,
    current_plan_version INTEGER NOT NULL,
    target_plan_code VARCHAR(40) NOT NULL,
    target_plan_version INTEGER NOT NULL,
    effective_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','CANCELLED','APPROVED','REJECTED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_plan_request_current FOREIGN KEY(current_plan_code,current_plan_version) REFERENCES subscription_plans(plan_code,version),
    CONSTRAINT fk_plan_request_target FOREIGN KEY(target_plan_code,target_plan_version) REFERENCES subscription_plans(plan_code,version)
);

CREATE INDEX ix_tenant_plan_requests_history ON tenant_plan_change_requests(tenant_id,requested_at DESC);
CREATE UNIQUE INDEX uk_tenant_plan_request_pending ON tenant_plan_change_requests(tenant_id) WHERE status='REQUESTED';
