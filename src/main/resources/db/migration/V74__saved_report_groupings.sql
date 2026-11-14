ALTER TABLE tenant_saved_reports
    ADD COLUMN group_by VARCHAR(64),
    ADD COLUMN metrics JSONB NOT NULL DEFAULT '[]'::jsonb;
