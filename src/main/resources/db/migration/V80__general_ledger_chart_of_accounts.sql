-- V80: Double-Entry General Ledger & Chart of Accounts (COA)

CREATE TABLE IF NOT EXISTS gl_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_code VARCHAR(32) NOT NULL,
    account_name VARCHAR(120) NOT NULL,
    account_type VARCHAR(32) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    sub_type VARCHAR(64) NOT NULL,    -- CURRENT_ASSET, FIXED_ASSET, CURRENT_LIABILITY, LONG_TERM_LIABILITY, EQUITY, OPERATING_REVENUE, COGS, OPERATING_EXPENSE
    normal_balance VARCHAR(16) NOT NULL DEFAULT 'DEBIT', -- DEBIT or CREDIT
    parent_account_id UUID REFERENCES gl_accounts(id) ON DELETE SET NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_gl_accounts_tenant_code UNIQUE (tenant_id, account_code)
);

CREATE INDEX IF NOT EXISTS ix_gl_accounts_tenant_type ON gl_accounts (tenant_id, account_type);
CREATE INDEX IF NOT EXISTS ix_gl_accounts_tenant_code ON gl_accounts (tenant_id, account_code);

CREATE TABLE IF NOT EXISTS gl_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_number VARCHAR(64) NOT NULL,
    posting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- MANUAL, INVOICE, SUPPLIER_BILL, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, POS_SALE, PERIOD_CLOSE
    source_reference_id UUID,
    source_reference_number VARCHAR(64),
    memo VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'POSTED', -- DRAFT, POSTED, VOIDED
    total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_gl_journal_entries_tenant_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT ck_gl_journal_balanced CHECK (total_debit = total_credit AND total_debit >= 0)
);

CREATE INDEX IF NOT EXISTS ix_gl_journal_entries_tenant_date ON gl_journal_entries (tenant_id, posting_date DESC);
CREATE INDEX IF NOT EXISTS ix_gl_journal_entries_tenant_source ON gl_journal_entries (tenant_id, source_type);
CREATE INDEX IF NOT EXISTS ix_gl_journal_entries_tenant_status ON gl_journal_entries (tenant_id, status);

CREATE TABLE IF NOT EXISTS gl_journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES gl_journal_entries(id) ON DELETE CASCADE,
    line_number INT NOT NULL DEFAULT 1,
    account_id UUID NOT NULL REFERENCES gl_accounts(id),
    debit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    description VARCHAR(255),
    party_name VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_gl_line_amounts CHECK (
        debit_amount >= 0 AND credit_amount >= 0 AND
        ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
    )
);

CREATE INDEX IF NOT EXISTS ix_gl_journal_lines_tenant_entry ON gl_journal_lines (tenant_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS ix_gl_journal_lines_tenant_account ON gl_journal_lines (tenant_id, account_id);

-- Seed standard Chart of Accounts for all tenants
DO $$
DECLARE
    t RECORD;
    a_id UUID;
    coa RECORD;
    t_id UUID := '86346062-7d9c-40e4-be16-2007ab592625'::uuid;
    jv1_id UUID := gen_random_uuid();
    jv2_id UUID := gen_random_uuid();
    jv3_id UUID := gen_random_uuid();
    jv4_id UUID := gen_random_uuid();
    jv5_id UUID := gen_random_uuid();
    jv6_id UUID := gen_random_uuid();
    jv7_id UUID := gen_random_uuid();
    acc_bank UUID;
    acc_equity UUID;
    acc_machinery UUID;
    acc_ar UUID;
    acc_ap UUID;
    acc_raw UUID;
    acc_cogs UUID;
    acc_sales UUID;
    acc_gst_out UUID;
    acc_rent UUID;
    acc_pos_drawer UUID;
    acc_pos_sales UUID;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        INSERT INTO gl_accounts (tenant_id, account_code, account_name, account_type, sub_type, normal_balance, is_system, description)
        VALUES
            (t.id, '1010', 'Cash on Hand', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Liquid vault cash and petty disbursements'),
            (t.id, '1020', 'Bank Operating Account', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Primary commercial bank checking account'),
            (t.id, '1050', 'POS Cash Drawer', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Point of sale counter physical float'),
            (t.id, '1100', 'Accounts Receivable (A/R)', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Outstanding invoice receivables from commercial clients'),
            (t.id, '1210', 'Raw Materials Inventory', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Direct raw materials stock valuation in warehouse'),
            (t.id, '1220', 'Work In Progress (WIP)', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Partially assembled production lots on shop floor'),
            (t.id, '1230', 'Finished Goods Inventory', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, 'Completed assemblies ready for commercial dispatch'),
            (t.id, '1500', 'Plant & Machinery', 'ASSET', 'FIXED_ASSET', 'DEBIT', true, 'Heavy machinery, CNC mills, and metrology tooling'),
            (t.id, '1590', 'Accumulated Depreciation - Machinery', 'ASSET', 'FIXED_ASSET', 'CREDIT', true, 'Contra-asset cumulative machinery depreciation'),
            (t.id, '2010', 'Accounts Payable (A/P)', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, 'Pending vendor obligations and supplier bills'),
            (t.id, '2110', 'GST Output Tax Payable', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, 'Collected GST liability owed to tax authorities'),
            (t.id, '2120', 'GST Input Tax Credit', 'LIABILITY', 'CURRENT_LIABILITY', 'DEBIT', true, 'Eligible GST credits paid on procurement invoices'),
            (t.id, '2200', 'Accrued Payroll & Benefits', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, 'Earned employee wages and withholding benefits'),
            (t.id, '3010', 'Owner Capital & Equity', 'EQUITY', 'EQUITY', 'CREDIT', true, 'Paid-in founder capital and partner shares'),
            (t.id, '3020', 'Retained Earnings', 'EQUITY', 'EQUITY', 'CREDIT', true, 'Cumulative undistributed net profit/loss'),
            (t.id, '4010', 'Manufacturing Sales Revenue', 'REVENUE', 'OPERATING_REVENUE', 'CREDIT', true, 'Commercial contract manufacturing sales'),
            (t.id, '4020', 'POS Retail Sales Revenue', 'REVENUE', 'OPERATING_REVENUE', 'CREDIT', true, 'Counter walk-in retail sales receipts'),
            (t.id, '4030', 'Engineering & Service Fees', 'REVENUE', 'OPERATING_REVENUE', 'CREDIT', true, 'Precision metrology and rapid prototyping fees'),
            (t.id, '5010', 'Raw Materials Consumed (COGS)', 'EXPENSE', 'COGS', 'DEBIT', true, 'Material cost recognized upon work order completion'),
            (t.id, '5020', 'Direct Manufacturing Labor', 'EXPENSE', 'COGS', 'DEBIT', true, 'Operator routing touch time allocated to production'),
            (t.id, '5030', 'Factory Power & Overheads', 'EXPENSE', 'COGS', 'DEBIT', true, 'Industrial 3-phase grid power and machining coolant'),
            (t.id, '6010', 'Salaries & Executive Wages', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'General, administrative, and engineering salaries'),
            (t.id, '6020', 'Plant Facility Rent & Utilities', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'Factory lease, security, and facility maintenance'),
            (t.id, '6030', 'Freight, Shipping & Logistics', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'Outbound freight, carrier surcharges, and challan handling'),
            (t.id, '6040', 'Equipment Repairs & Maintenance', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'CMMS breakdown spare parts and preventative calibration'),
            (t.id, '6050', 'Bank & Payment Gateway Fees', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, 'Credit card processing fees and bank transaction tariffs')
        ON CONFLICT (tenant_id, account_code) DO NOTHING;
    END LOOP;

    -- Seed realistic sample Journal Vouchers for Soof tenant
    IF EXISTS (SELECT 1 FROM tenants WHERE id = t_id) THEN
        SELECT id INTO acc_bank FROM gl_accounts WHERE tenant_id = t_id AND account_code = '1020';
        SELECT id INTO acc_equity FROM gl_accounts WHERE tenant_id = t_id AND account_code = '3010';
        SELECT id INTO acc_machinery FROM gl_accounts WHERE tenant_id = t_id AND account_code = '1500';
        SELECT id INTO acc_ar FROM gl_accounts WHERE tenant_id = t_id AND account_code = '1100';
        SELECT id INTO acc_ap FROM gl_accounts WHERE tenant_id = t_id AND account_code = '2010';
        SELECT id INTO acc_raw FROM gl_accounts WHERE tenant_id = t_id AND account_code = '1210';
        SELECT id INTO acc_cogs FROM gl_accounts WHERE tenant_id = t_id AND account_code = '5010';
        SELECT id INTO acc_sales FROM gl_accounts WHERE tenant_id = t_id AND account_code = '4010';
        SELECT id INTO acc_gst_out FROM gl_accounts WHERE tenant_id = t_id AND account_code = '2110';
        SELECT id INTO acc_rent FROM gl_accounts WHERE tenant_id = t_id AND account_code = '6020';
        SELECT id INTO acc_pos_drawer FROM gl_accounts WHERE tenant_id = t_id AND account_code = '1050';
        SELECT id INTO acc_pos_sales FROM gl_accounts WHERE tenant_id = t_id AND account_code = '4020';

        -- JV 1: Initial Capital Injection
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, memo, status, total_debit, total_credit)
        VALUES (jv1_id, t_id, 'JV-202611-0001', CURRENT_DATE - INTERVAL '14 days', 'MANUAL', 'Founder equity capitalization & initial bank deposit', 'POSTED', 2500000.00, 2500000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv1_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv1_id, 1, acc_bank, 2500000.00, 0.00, 'Operating capital deposit into HDFC current account', 'Founder Capital'),
            (t_id, jv1_id, 2, acc_equity, 0.00, 2500000.00, 'Initial equity allotment for manufacturing operations', 'Founders');

        -- JV 2: Machine Capex Purchase
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, memo, status, total_debit, total_credit)
        VALUES (jv2_id, t_id, 'JV-202611-0002', CURRENT_DATE - INTERVAL '10 days', 'MANUAL', 'Acquisition of Haas VF-2 CNC 4-Axis Milling Machine', 'POSTED', 750000.00, 750000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv2_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv2_id, 1, acc_machinery, 750000.00, 0.00, 'Haas CNC Milling Center capital expenditure asset', 'Haas Automation Inc'),
            (t_id, jv2_id, 2, acc_bank, 0.00, 750000.00, 'Wire transfer payment from HDFC checking account', 'HDFC Bank');

        -- JV 3: Raw Material Procurement on Credit
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, source_reference_number, memo, status, total_debit, total_credit)
        VALUES (jv3_id, t_id, 'JV-202611-0003', CURRENT_DATE - INTERVAL '7 days', 'SUPPLIER_BILL', 'BILL-202611-01', 'Titanium bar stock & grade 8.8 fastener replenishment', 'POSTED', 320000.00, 320000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv3_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv3_id, 1, acc_raw, 320000.00, 0.00, 'Titanium alloy bar stock intake to raw materials warehouse', 'Apex Precision Tools'),
            (t_id, jv3_id, 2, acc_ap, 0.00, 320000.00, 'Trade vendor accounts payable net-30 terms', 'Apex Precision Tools');

        -- JV 4: Commercial Contract Manufacturing Sales
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, source_reference_number, memo, status, total_debit, total_credit)
        VALUES (jv4_id, t_id, 'JV-202611-0004', CURRENT_DATE - INTERVAL '5 days', 'INVOICE', 'INV-202611-001', 'Commercial invoicing for hydraulic actuator assemblies', 'POSTED', 590000.00, 590000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv4_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv4_id, 1, acc_ar, 590000.00, 0.00, 'Trade receivable due from customer under net-15', 'Vanguard Heavy Engineering'),
            (t_id, jv4_id, 2, acc_sales, 0.00, 500000.00, 'Recognized manufacturing sales revenue', 'Vanguard Heavy Engineering'),
            (t_id, jv4_id, 3, acc_gst_out, 0.00, 90000.00, 'GST Output liability (18% tax on industrial components)', 'Tax Authority');

        -- JV 5: COGS Material Consumption
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, memo, status, total_debit, total_credit)
        VALUES (jv5_id, t_id, 'JV-202611-0005', CURRENT_DATE - INTERVAL '3 days', 'MANUAL', 'Material consumption recognition for completed Work Order WO-49B00E', 'POSTED', 180000.00, 180000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv5_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv5_id, 1, acc_cogs, 180000.00, 0.00, 'Direct material absorption into cost of goods sold', 'Shop Floor Operations'),
            (t_id, jv5_id, 2, acc_raw, 0.00, 180000.00, 'Inventory deduction from raw materials bin', 'Main Warehouse');

        -- JV 6: Plant Rent & Facility Utility Expenses
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, memo, status, total_debit, total_credit)
        VALUES (jv6_id, t_id, 'JV-202611-0006', CURRENT_DATE - INTERVAL '2 days', 'MANUAL', 'Facility lease rental and industrial power settlement', 'POSTED', 65000.00, 65000.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv6_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv6_id, 1, acc_rent, 65000.00, 0.00, 'Industrial plant lease and power utility payment', 'Industrial Estate Authority'),
            (t_id, jv6_id, 2, acc_bank, 0.00, 65000.00, 'Bank direct debit clearance', 'HDFC Bank');

        -- JV 7: POS Shift Reconciliation
        INSERT INTO gl_journal_entries (id, tenant_id, entry_number, posting_date, source_type, source_reference_number, memo, status, total_debit, total_credit)
        VALUES (jv7_id, t_id, 'JV-202611-0007', CURRENT_DATE - INTERVAL '1 day', 'POS_SALE', 'POS-REC-01', 'Point of sale daily counter register receipts', 'POSTED', 42500.00, 42500.00)
        ON CONFLICT (tenant_id, entry_number) DO UPDATE SET memo = EXCLUDED.memo
        RETURNING id INTO jv7_id;

        INSERT INTO gl_journal_lines (tenant_id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, party_name)
        VALUES 
            (t_id, jv7_id, 1, acc_pos_drawer, 42500.00, 0.00, 'Cash and card tender deposited into store register float', 'Walk-in Retail'),
            (t_id, jv7_id, 2, acc_pos_sales, 0.00, 36017.00, 'Recognized retail store product sales revenue', 'Walk-in Retail'),
            (t_id, jv7_id, 3, acc_gst_out, 0.00, 6483.00, 'Collected retail sales tax liability (18% GST)', 'Tax Authority');

    END IF;
END $$;
