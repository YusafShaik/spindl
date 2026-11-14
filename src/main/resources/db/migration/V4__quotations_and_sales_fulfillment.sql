ALTER TABLE items ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD CONSTRAINT ck_items_reserved_quantity CHECK (reserved_quantity >= 0 AND reserved_quantity <= on_hand);

CREATE TABLE sales_quotes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    quote_number VARCHAR(64) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    valid_until DATE,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_sales_quotes_tenant_number UNIQUE (tenant_id, quote_number)
);
CREATE INDEX ix_sales_quotes_tenant_created ON sales_quotes (tenant_id, created_at DESC);

CREATE TABLE sales_quote_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    quote_id UUID NOT NULL REFERENCES sales_quotes(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    CONSTRAINT uk_sales_quote_line_item UNIQUE (quote_id, item_id)
);

CREATE TABLE sales_orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_number VARCHAR(64) NOT NULL,
    quote_id UUID NOT NULL REFERENCES sales_quotes(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_sales_orders_tenant_number UNIQUE (tenant_id, order_number),
    CONSTRAINT uk_sales_orders_tenant_quote UNIQUE (tenant_id, quote_id)
);
CREATE INDEX ix_sales_orders_tenant_created ON sales_orders (tenant_id, created_at DESC);

CREATE TABLE sales_order_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
    quote_line_id UUID NOT NULL REFERENCES sales_quote_lines(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    shipped_quantity INTEGER NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0 AND shipped_quantity <= quantity),
    reserved_quantity INTEGER NOT NULL CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    CONSTRAINT uk_sales_order_line_item UNIQUE (sales_order_id, item_id)
);
CREATE INDEX ix_sales_order_lines_tenant_order ON sales_order_lines (tenant_id, sales_order_id);

CREATE TABLE sales_shipments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
    shipment_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    shipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_sales_shipments_tenant_number UNIQUE (tenant_id, shipment_number),
    CONSTRAINT uk_sales_shipments_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE sales_shipment_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    shipment_id UUID NOT NULL REFERENCES sales_shipments(id),
    sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
