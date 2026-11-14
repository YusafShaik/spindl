CREATE TABLE tenant_finance_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
    tax_code VARCHAR(24) NOT NULL DEFAULT 'NONE',
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    invoice_prefix VARCHAR(8) NOT NULL DEFAULT 'INV',
    next_invoice_number BIGINT NOT NULL DEFAULT 1 CHECK (next_invoice_number > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenant_finance_settings(tenant_id)
SELECT id FROM tenants ON CONFLICT (tenant_id) DO NOTHING;

CREATE FUNCTION create_tenant_finance_settings() RETURNS trigger AS $$
BEGIN
    INSERT INTO tenant_finance_settings(tenant_id) VALUES (NEW.id) ON CONFLICT (tenant_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_create_finance_settings
    AFTER INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION create_tenant_finance_settings();

ALTER TABLE invoices ADD COLUMN subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0);
ALTER TABLE invoices ADD COLUMN tax_code VARCHAR(24) NOT NULL DEFAULT 'NONE';
ALTER TABLE invoices ADD COLUMN tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100);
ALTER TABLE invoices ADD COLUMN tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0);
UPDATE invoices SET subtotal=total;

ALTER TABLE invoice_lines ADD COLUMN tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100);
ALTER TABLE invoice_lines ADD COLUMN tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);
ALTER TABLE invoice_lines ADD COLUMN gross_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gross_total >= 0);
UPDATE invoice_lines SET gross_total=line_total;
