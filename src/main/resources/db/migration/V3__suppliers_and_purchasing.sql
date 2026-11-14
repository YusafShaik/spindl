CREATE TABLE suppliers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(180) NOT NULL,
    email VARCHAR(254) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_suppliers_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_suppliers_tenant_name ON suppliers (tenant_id, name);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_number VARCHAR(64) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_purchase_orders_tenant_number UNIQUE (tenant_id, order_number)
);
CREATE INDEX ix_purchase_orders_tenant_created ON purchase_orders (tenant_id, created_at DESC);
CREATE SEQUENCE purchase_order_number_seq START WITH 1;

CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    item_id UUID NOT NULL REFERENCES items(id),
    ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
    accepted_quantity INTEGER NOT NULL DEFAULT 0 CHECK (accepted_quantity >= 0 AND accepted_quantity <= received_quantity),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    CONSTRAINT uk_purchase_order_line_item UNIQUE (purchase_order_id, item_id)
);
CREATE INDEX ix_purchase_order_lines_tenant_order ON purchase_order_lines (tenant_id, purchase_order_id);

CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    receipt_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_goods_receipts_tenant_number UNIQUE (tenant_id, receipt_number),
    CONSTRAINT uk_goods_receipts_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE goods_receipt_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id),
    purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
    accepted_quantity INTEGER NOT NULL DEFAULT 0 CHECK (accepted_quantity >= 0),
    rejected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    CHECK (accepted_quantity + rejected_quantity > 0)
);
CREATE INDEX ix_goods_receipt_lines_tenant_receipt ON goods_receipt_lines (tenant_id, goods_receipt_id);

INSERT INTO suppliers (id, tenant_id, code, name, email, status) VALUES
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000001','SUP-001','Steelcraft Materials Ltd.','orders@steelcraft.in','Active'),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000001','SUP-002','Metro Fasteners Co.','sales@metrofasteners.in','Active');
