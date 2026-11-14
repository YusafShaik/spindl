ALTER TABLE purchase_order_lines ADD COLUMN billed_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_lines ADD CONSTRAINT ck_purchase_line_billed CHECK (billed_quantity >= 0 AND returned_quantity + billed_quantity <= accepted_quantity);

CREATE TABLE supplier_bills (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    bill_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'unpaid',
    due_date DATE NOT NULL,
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0 AND amount_paid <= total),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_supplier_bills_tenant_number UNIQUE (tenant_id, bill_number),
    CONSTRAINT uk_supplier_bills_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_supplier_bills_tenant_supplier_status ON supplier_bills (tenant_id, supplier_id, status);
CREATE INDEX ix_supplier_bills_tenant_issued ON supplier_bills (tenant_id, issued_at DESC);

CREATE TABLE supplier_bill_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    supplier_bill_id UUID NOT NULL REFERENCES supplier_bills(id),
    purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE supplier_bill_payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    supplier_bill_id UUID NOT NULL REFERENCES supplier_bills(id),
    idempotency_key VARCHAR(120) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(32) NOT NULL,
    reference VARCHAR(120),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_supplier_bill_payments_tenant_bill_idempotency UNIQUE (tenant_id, supplier_bill_id, idempotency_key)
);
CREATE INDEX ix_supplier_bill_payments_bill_time ON supplier_bill_payments (tenant_id, supplier_bill_id, paid_at DESC);

CREATE FUNCTION reject_supplier_bill_payment_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Supplier bill payments are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER supplier_bill_payments_append_only
    BEFORE UPDATE OR DELETE ON supplier_bill_payments
    FOR EACH ROW EXECUTE FUNCTION reject_supplier_bill_payment_mutation();
