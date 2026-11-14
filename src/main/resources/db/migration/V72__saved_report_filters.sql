ALTER TABLE tenant_saved_reports
    ADD COLUMN filters JSONB NOT NULL DEFAULT '[]'::jsonb;
