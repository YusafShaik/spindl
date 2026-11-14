ALTER TABLE tenant_saved_reports
    ADD CONSTRAINT uk_saved_report_tenant_id_id UNIQUE (tenant_id, id);

CREATE TABLE tenant_saved_report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES app_users(id),
    frequency VARCHAR(12) NOT NULL CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY')),
    run_at TIME NOT NULL,
    week_day SMALLINT,
    month_day SMALLINT,
    timezone VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_saved_report_schedule_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_saved_report_schedule_report FOREIGN KEY (tenant_id, report_id)
        REFERENCES tenant_saved_reports(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT uk_saved_report_schedule UNIQUE (tenant_id, report_id)
);

ALTER TABLE tenant_saved_report_schedules
    ADD CONSTRAINT ck_saved_report_schedule_day CHECK (
        (frequency='DAILY' AND week_day IS NULL AND month_day IS NULL) OR
        (frequency='WEEKLY' AND week_day BETWEEN 1 AND 7 AND month_day IS NULL) OR
        (frequency='MONTHLY' AND month_day BETWEEN 1 AND 28 AND week_day IS NULL)
    );

CREATE INDEX ix_saved_report_schedule_due ON tenant_saved_report_schedules(next_run_at)
    WHERE enabled = TRUE;

CREATE TABLE tenant_saved_report_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL,
    report_name VARCHAR(120) NOT NULL,
    status VARCHAR(12) NOT NULL CHECK (status IN ('COMPLETED','FAILED')),
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message VARCHAR(500),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_saved_report_run_schedule FOREIGN KEY (tenant_id, schedule_id)
        REFERENCES tenant_saved_report_schedules(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX ix_saved_report_runs_history ON tenant_saved_report_runs(tenant_id, schedule_id, completed_at DESC);
