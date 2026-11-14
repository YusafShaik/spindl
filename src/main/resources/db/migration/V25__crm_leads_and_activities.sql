CREATE TABLE crm_leads (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(180) NOT NULL,
    company VARCHAR(180),
    email VARCHAR(254),
    phone VARCHAR(40),
    source VARCHAR(80),
    stage VARCHAR(24) NOT NULL CHECK (stage IN ('NEW','QUALIFIED','PROPOSAL','WON','LOST')),
    owner_user_id UUID REFERENCES app_users(id),
    expected_value NUMERIC(14,2),
    next_activity_title VARCHAR(180),
    next_activity_at TIMESTAMPTZ,
    converted_customer_id UUID REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_crm_lead_contact CHECK (coalesce(email,'') <> '' OR coalesce(phone,'') <> '')
);
CREATE INDEX ix_crm_leads_pipeline ON crm_leads(tenant_id, stage, updated_at DESC);
CREATE INDEX ix_crm_leads_owner ON crm_leads(tenant_id, owner_user_id, stage);

CREATE TABLE crm_lead_activities (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    lead_id UUID NOT NULL REFERENCES crm_leads(id),
    actor_user_id UUID NOT NULL REFERENCES app_users(id),
    activity_type VARCHAR(24) NOT NULL CHECK (activity_type IN ('NOTE','CALL','EMAIL','MEETING','TASK')),
    body VARCHAR(2000) NOT NULL,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_crm_lead_activity_history ON crm_lead_activities(tenant_id, lead_id, created_at DESC);
