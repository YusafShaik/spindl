ALTER TABLE purchase_orders ADD CONSTRAINT uk_purchase_orders_tenant_id UNIQUE (tenant_id,id);

CREATE TABLE purchase_requisitions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    requisition_number VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    requested_by UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','CONVERTED')),
    need_by_date DATE,
    notes VARCHAR(1000),
    approved_by UUID REFERENCES app_users(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES app_users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason VARCHAR(500),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    conversion_idempotency_key VARCHAR(120),
    conversion_request_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_purchase_requisitions_tenant_number UNIQUE (tenant_id,requisition_number),
    CONSTRAINT uk_purchase_requisitions_tenant_idempotency UNIQUE (tenant_id,idempotency_key),
    CONSTRAINT uk_purchase_requisitions_tenant_id UNIQUE (tenant_id,id),
    CONSTRAINT uk_purchase_requisitions_purchase_order UNIQUE (purchase_order_id),
    CONSTRAINT fk_purchase_requisition_tenant_po FOREIGN KEY (tenant_id,purchase_order_id) REFERENCES purchase_orders(tenant_id,id),
    CHECK ((status='CONVERTED') = (purchase_order_id IS NOT NULL))
);
CREATE INDEX ix_purchase_requisitions_tenant_status ON purchase_requisitions(tenant_id,status,created_at DESC);

CREATE TABLE purchase_requisition_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    CONSTRAINT uk_purchase_requisition_line_item UNIQUE (requisition_id,item_id),
    CONSTRAINT fk_purchase_requisition_line_tenant_request FOREIGN KEY (tenant_id,requisition_id) REFERENCES purchase_requisitions(tenant_id,id),
    CONSTRAINT fk_purchase_requisition_line_tenant_item FOREIGN KEY (tenant_id,item_id) REFERENCES items(tenant_id,id)
);
CREATE INDEX ix_purchase_requisition_lines_tenant_requisition ON purchase_requisition_lines(tenant_id,requisition_id);
