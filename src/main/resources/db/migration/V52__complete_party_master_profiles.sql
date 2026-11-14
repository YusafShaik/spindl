ALTER TABLE customers
    ADD COLUMN customer_type VARCHAR(16) NOT NULL DEFAULT 'COMPANY' CHECK (customer_type IN ('INDIVIDUAL','COMPANY')),
    ADD COLUMN contact_name VARCHAR(180),
    ADD COLUMN phone VARCHAR(40),
    ADD COLUMN address_line1 VARCHAR(180),
    ADD COLUMN address_line2 VARCHAR(180),
    ADD COLUMN city VARCHAR(100),
    ADD COLUMN region VARCHAR(100),
    ADD COLUMN postal_code VARCHAR(24),
    ADD COLUMN country_code VARCHAR(2),
    ADD COLUMN tax_id VARCHAR(80),
    ADD COLUMN payment_terms_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms_days BETWEEN 0 AND 365),
    ADD COLUMN credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    ADD COLUMN tags TEXT NOT NULL DEFAULT '',
    ADD COLUMN owner_user_id UUID,
    ADD COLUMN credit_hold BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE customers SET owner_user_id=created_by WHERE created_by IS NOT NULL;
ALTER TABLE customers ADD CONSTRAINT fk_customer_owner_membership FOREIGN KEY (tenant_id,owner_user_id) REFERENCES tenant_memberships(tenant_id,user_id);
CREATE INDEX ix_customers_tenant_owner ON customers(tenant_id,owner_user_id);

ALTER TABLE suppliers
    ADD COLUMN contact_name VARCHAR(180),
    ADD COLUMN phone VARCHAR(40),
    ADD COLUMN address_line1 VARCHAR(180),
    ADD COLUMN address_line2 VARCHAR(180),
    ADD COLUMN city VARCHAR(100),
    ADD COLUMN region VARCHAR(100),
    ADD COLUMN postal_code VARCHAR(24),
    ADD COLUMN country_code VARCHAR(2),
    ADD COLUMN tax_id VARCHAR(80),
    ADD COLUMN payment_terms_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms_days BETWEEN 0 AND 365),
    ADD COLUMN lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days BETWEEN 0 AND 3650),
    ADD COLUMN rating NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
    ADD COLUMN notes VARCHAR(1000);
