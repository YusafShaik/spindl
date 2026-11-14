CREATE TABLE pos_registers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    warehouse_id UUID NOT NULL,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_pos_registers_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uk_pos_registers_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_pos_registers_warehouse FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id)
);

CREATE TABLE pos_register_sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    register_id UUID NOT NULL,
    cashier_user_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('OPEN','CLOSED')),
    opening_float NUMERIC(14,2) NOT NULL CHECK (opening_float >= 0),
    expected_cash NUMERIC(14,2),
    counted_cash NUMERIC(14,2),
    cash_variance NUMERIC(14,2),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT uk_pos_sessions_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_pos_sessions_register FOREIGN KEY (tenant_id, register_id) REFERENCES pos_registers(tenant_id, id),
    CONSTRAINT ck_pos_session_close_values CHECK ((status = 'OPEN' AND closed_at IS NULL AND counted_cash IS NULL) OR (status = 'CLOSED' AND closed_at IS NOT NULL AND expected_cash IS NOT NULL AND counted_cash IS NOT NULL AND cash_variance IS NOT NULL))
);
CREATE UNIQUE INDEX uk_pos_one_open_session_per_register ON pos_register_sessions(tenant_id, register_id) WHERE status = 'OPEN';
CREATE INDEX ix_pos_sessions_tenant_opened ON pos_register_sessions(tenant_id, opened_at DESC);

CREATE TABLE pos_sales (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    session_id UUID NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    receipt_number VARCHAR(64) NOT NULL,
    customer_id UUID,
    status VARCHAR(16) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','VOIDED','REFUNDED','PARTIAL_REFUND')),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    tax_code VARCHAR(24) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
    tax_total NUMERIC(14,2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_pos_sales_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uk_pos_sales_tenant_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uk_pos_sales_tenant_receipt UNIQUE (tenant_id, receipt_number),
    CONSTRAINT fk_pos_sales_session FOREIGN KEY (tenant_id, session_id) REFERENCES pos_register_sessions(tenant_id, id),
    CONSTRAINT fk_pos_sales_customer FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id)
);
CREATE INDEX ix_pos_sales_tenant_posted ON pos_sales(tenant_id, posted_at DESC);

CREATE TABLE pos_sale_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sale_id UUID NOT NULL,
    item_id UUID NOT NULL,
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    tax_total NUMERIC(14,2) NOT NULL CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    CONSTRAINT fk_pos_sale_lines_sale FOREIGN KEY (tenant_id, sale_id) REFERENCES pos_sales(tenant_id, id),
    CONSTRAINT fk_pos_sale_lines_item FOREIGN KEY (tenant_id, item_id) REFERENCES items(tenant_id, id)
);

CREATE TABLE pos_sale_tenders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sale_id UUID NOT NULL,
    method VARCHAR(16) NOT NULL CHECK (method IN ('CASH','CARD','UPI','OTHER')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    reference VARCHAR(120),
    CONSTRAINT fk_pos_sale_tenders_sale FOREIGN KEY (tenant_id, sale_id) REFERENCES pos_sales(tenant_id, id)
);
