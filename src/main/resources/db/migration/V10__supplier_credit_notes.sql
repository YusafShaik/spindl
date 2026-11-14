ALTER TABLE purchase_order_lines DROP CONSTRAINT ck_purchase_line_returned;
ALTER TABLE purchase_order_lines DROP CONSTRAINT ck_purchase_line_billed;
ALTER TABLE purchase_order_lines ADD COLUMN credited_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_lines ADD CONSTRAINT ck_purchase_line_billed CHECK (billed_quantity >= 0 AND billed_quantity <= accepted_quantity);
ALTER TABLE purchase_order_lines ADD CONSTRAINT ck_purchase_line_credited CHECK (credited_quantity >= 0 AND credited_quantity <= billed_quantity);
ALTER TABLE purchase_order_lines ADD CONSTRAINT ck_purchase_line_returned CHECK (returned_quantity >= 0 AND returned_quantity <= accepted_quantity);

ALTER TABLE supplier_bills ADD COLUMN amount_credited NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_credited >= 0 AND amount_paid + amount_credited <= total);
ALTER TABLE supplier_bill_lines ADD COLUMN credited_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supplier_bill_lines ADD CONSTRAINT ck_supplier_bill_line_credited CHECK (credited_quantity >= 0 AND credited_quantity <= quantity);

CREATE TABLE supplier_credit_notes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    supplier_bill_id UUID NOT NULL REFERENCES supplier_bills(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    credit_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_supplier_credit_notes_tenant_number UNIQUE (tenant_id, credit_number),
    CONSTRAINT uk_supplier_credit_notes_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ix_supplier_credit_notes_tenant_bill ON supplier_credit_notes (tenant_id, supplier_bill_id, issued_at DESC);

CREATE TABLE supplier_credit_note_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    supplier_credit_note_id UUID NOT NULL REFERENCES supplier_credit_notes(id),
    supplier_bill_line_id UUID NOT NULL REFERENCES supplier_bill_lines(id),
    purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
    item_id UUID NOT NULL REFERENCES items(id),
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0)
);
