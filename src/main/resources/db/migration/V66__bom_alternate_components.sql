ALTER TABLE bom_lines ADD COLUMN alternative_group VARCHAR(40);
CREATE INDEX ix_bom_lines_alternative_group ON bom_lines(tenant_id, bom_id, alternative_group);
