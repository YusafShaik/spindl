ALTER TABLE pos_sales ADD COLUMN refunded_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refunded_total >= 0 AND refunded_total <= total);
ALTER TABLE pos_sale_lines ADD COLUMN refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0 AND refunded_quantity <= quantity);
ALTER TABLE pos_sale_lines ADD COLUMN refunded_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refunded_subtotal >= 0 AND refunded_subtotal <= subtotal);
ALTER TABLE pos_sale_lines ADD COLUMN refunded_tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refunded_tax_total >= 0 AND refunded_tax_total <= tax_total);
ALTER TABLE pos_sale_lines ADD CONSTRAINT uk_pos_sale_lines_tenant_id UNIQUE (tenant_id,id);

CREATE TABLE pos_refunds (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sale_id UUID NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    refund_number VARCHAR(64) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal > 0),
    tax_total NUMERIC(14,2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total > 0),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_pos_refunds_tenant_id UNIQUE (tenant_id,id),
    CONSTRAINT uk_pos_refunds_tenant_idempotency UNIQUE (tenant_id,idempotency_key),
    CONSTRAINT uk_pos_refunds_tenant_number UNIQUE (tenant_id,refund_number),
    CONSTRAINT fk_pos_refunds_sale FOREIGN KEY (tenant_id,sale_id) REFERENCES pos_sales(tenant_id,id)
);
CREATE INDEX ix_pos_refunds_tenant_created ON pos_refunds(tenant_id,created_at DESC);

CREATE TABLE pos_refund_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    refund_id UUID NOT NULL,
    sale_line_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    disposition VARCHAR(16) NOT NULL CHECK (disposition IN ('RESTOCK','QUARANTINE','SCRAP')),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal > 0),
    tax_total NUMERIC(14,2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total > 0),
    CONSTRAINT fk_pos_refund_lines_refund FOREIGN KEY (tenant_id,refund_id) REFERENCES pos_refunds(tenant_id,id),
    CONSTRAINT fk_pos_refund_lines_sale_line FOREIGN KEY (tenant_id,sale_line_id) REFERENCES pos_sale_lines(tenant_id,id)
);

CREATE TABLE pos_refund_tenders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    refund_id UUID NOT NULL,
    method VARCHAR(16) NOT NULL CHECK (method IN ('CASH','CARD','UPI','OTHER')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    reference VARCHAR(120),
    CONSTRAINT fk_pos_refund_tenders_refund FOREIGN KEY (tenant_id,refund_id) REFERENCES pos_refunds(tenant_id,id)
);
