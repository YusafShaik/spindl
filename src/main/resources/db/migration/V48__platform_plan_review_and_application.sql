DO $$
DECLARE status_constraint RECORD;
BEGIN
    FOR status_constraint IN
        SELECT conname FROM pg_constraint
        WHERE conrelid='tenant_plan_change_requests'::regclass
          AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE tenant_plan_change_requests DROP CONSTRAINT %I',status_constraint.conname);
    END LOOP;
END $$;

ALTER TABLE tenant_plan_change_requests
    ADD CONSTRAINT ck_tenant_plan_requests_status CHECK (status IN ('REQUESTED','CANCELLED','APPROVED','REJECTED','APPLIED')),
    ADD COLUMN reviewed_by UUID REFERENCES app_users(id),
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN review_note VARCHAR(500),
    ADD COLUMN applied_at TIMESTAMPTZ;

CREATE INDEX ix_tenant_plan_requests_due
    ON tenant_plan_change_requests(status,effective_date)
    WHERE status='APPROVED';
