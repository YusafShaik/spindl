CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(40) NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    display_name VARCHAR(100) NOT NULL,
    seat_limit INTEGER NOT NULL CHECK (seat_limit > 0),
    storage_limit_mb INTEGER NOT NULL CHECK (storage_limit_mb > 0),
    api_calls_per_month BIGINT NOT NULL CHECK (api_calls_per_month > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_subscription_plan_version UNIQUE(plan_code, version)
);

INSERT INTO subscription_plans(plan_code,version,display_name,seat_limit,storage_limit_mb,api_calls_per_month) VALUES
    ('TRIAL',1,'Trial',5,1024,50000),
    ('STARTER_CRM',1,'Starter CRM',3,2048,100000),
    ('INVENTORY_LITE',1,'Inventory Lite',5,5120,250000),
    ('COMMERCE_OPS',1,'Commerce Ops',10,20480,1000000),
    ('MANUFACTURING',1,'Manufacturing',25,102400,5000000);

CREATE TABLE tenant_subscriptions (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    plan_code VARCHAR(40) NOT NULL,
    plan_version INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_ends_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_tenant_subscription_plan FOREIGN KEY(plan_code,plan_version)
        REFERENCES subscription_plans(plan_code,version),
    CONSTRAINT ck_tenant_subscription_status CHECK (status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELLED'))
);

INSERT INTO tenant_subscriptions(tenant_id,plan_code,plan_version,status)
SELECT id,'TRIAL',1,CASE status WHEN 'trial' THEN 'TRIAL' WHEN 'active' THEN 'ACTIVE' WHEN 'past_due' THEN 'PAST_DUE' ELSE 'CANCELLED' END FROM tenants;
