ALTER TABLE tenants
    ADD COLUMN legal_name VARCHAR(180),
    ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    ADD COLUMN fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN grace_period_ends_at TIMESTAMPTZ,
    ADD COLUMN closed_at TIMESTAMPTZ,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE tenants
    ADD CONSTRAINT ck_tenants_status CHECK (status IN ('trial','active','past_due','suspended','closed')),
    ADD CONSTRAINT ck_tenants_fiscal_month CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

CREATE INDEX ix_tenants_status_grace ON tenants(status,grace_period_ends_at);
