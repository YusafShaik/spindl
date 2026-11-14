ALTER TABLE sales_order_lines ADD COLUMN invoiced_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales_order_lines ADD CONSTRAINT ck_sales_order_line_invoiced CHECK (invoiced_quantity >= 0 AND invoiced_quantity <= shipped_quantity);

CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_number VARCHAR(64) NOT NULL,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    idempotency_key VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'unpaid',
    due_date DATE NOT NULL,
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0 AND amount_paid <= total),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_invoices_tenant_number UNIQUE (tenant_id, invoice_number),
    CONSTRAINT uk_invoices_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_invoices_tenant_customer_status ON invoices (tenant_id, customer_id, status);
CREATE INDEX ix_invoices_tenant_issued ON invoices (tenant_id, issued_at DESC);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id),
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    idempotency_key VARCHAR(120) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(32) NOT NULL,
    reference VARCHAR(120),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_invoice_payments_tenant_invoice_idempotency UNIQUE (tenant_id, invoice_id, idempotency_key)
);
CREATE INDEX ix_invoice_payments_tenant_invoice ON invoice_payments (tenant_id, invoice_id, received_at DESC);

CREATE FUNCTION reject_invoice_payment_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Invoice payments are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_payments_append_only
    BEFORE UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION reject_invoice_payment_mutation();
