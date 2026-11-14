ALTER TABLE invoices ADD COLUMN credit_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_total >= 0 AND credit_total <= total);
ALTER TABLE invoice_lines ADD COLUMN credited_quantity INTEGER NOT NULL DEFAULT 0 CHECK (credited_quantity >= 0 AND credited_quantity <= quantity);
ALTER TABLE invoice_lines ADD COLUMN credited_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credited_tax_amount >= 0);

ALTER TABLE quality_lots DROP CONSTRAINT quality_lots_source_type_check;
ALTER TABLE quality_lots ADD CONSTRAINT ck_quality_lots_source_type CHECK (source_type IN ('PURCHASE_RECEIPT','WORK_ORDER_OUTPUT','OPENING_STOCK','CUSTOMER_RETURN'));

CREATE TABLE customer_credit_notes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    credit_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    tax_total NUMERIC(14,2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total > 0),
    refund_due NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refund_due >= 0 AND refund_due <= total),
    amount_refunded NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_refunded >= 0 AND amount_refunded <= refund_due),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_customer_credit_notes_tenant_number UNIQUE (tenant_id,credit_number),
    CONSTRAINT uk_customer_credit_notes_tenant_idempotency UNIQUE (tenant_id,idempotency_key)
);
CREATE INDEX ix_customer_credit_notes_tenant_invoice ON customer_credit_notes(tenant_id,invoice_id,issued_at DESC);

CREATE TABLE customer_credit_note_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    credit_note_id UUID NOT NULL REFERENCES customer_credit_notes(id),
    invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
    warehouse_id UUID NOT NULL,
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    disposition VARCHAR(16) NOT NULL CHECK (disposition IN ('RESTOCK','QUARANTINE','SCRAP')),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(5,2) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(14,2) NOT NULL CHECK (tax_amount >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT fk_customer_credit_line_warehouse FOREIGN KEY (tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id),
    CONSTRAINT uk_customer_credit_note_invoice_line UNIQUE (credit_note_id,invoice_line_id)
);

CREATE TABLE customer_credit_refunds (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    credit_note_id UUID NOT NULL REFERENCES customer_credit_notes(id),
    idempotency_key VARCHAR(120) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(32) NOT NULL,
    reference VARCHAR(120),
    refunded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_customer_credit_refunds_tenant_note_key UNIQUE (tenant_id,credit_note_id,idempotency_key)
);
CREATE INDEX ix_customer_credit_refunds_tenant_note ON customer_credit_refunds(tenant_id,credit_note_id,refunded_at DESC);

CREATE FUNCTION reject_customer_credit_refund_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Customer credit refunds are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER customer_credit_refunds_append_only
    BEFORE UPDATE OR DELETE ON customer_credit_refunds
    FOR EACH ROW EXECUTE FUNCTION reject_customer_credit_refund_mutation();
