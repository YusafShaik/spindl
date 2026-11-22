-- V77: Outbound Logistics, Delivery Challans, Multi-Box Packaging & e-Way Bill Compliance

CREATE TABLE delivery_challans (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    challan_number VARCHAR(64) NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PACKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    carrier_name VARCHAR(120),
    carrier_mode VARCHAR(32) NOT NULL DEFAULT 'ROAD' CHECK (carrier_mode IN ('ROAD', 'AIR', 'RAIL', 'SEA', 'SELF_PICKUP')),
    tracking_number VARCHAR(120),
    vehicle_number VARCHAR(64),
    driver_name VARCHAR(120),
    driver_phone VARCHAR(32),
    eway_bill_number VARCHAR(64),
    eway_bill_valid_till TIMESTAMP WITH TIME ZONE,
    shipping_address TEXT,
    notes TEXT,
    total_packages INT NOT NULL DEFAULT 1,
    total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    pod_recipient_name VARCHAR(120),
    pod_notes TEXT,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_delivery_challans_tenant_number UNIQUE (tenant_id, challan_number)
);

CREATE INDEX ix_delivery_challans_tenant_status ON delivery_challans(tenant_id, status);
CREATE INDEX ix_delivery_challans_tenant_created ON delivery_challans(tenant_id, created_at DESC);
CREATE INDEX ix_delivery_challans_tenant_order ON delivery_challans(tenant_id, sales_order_id);

CREATE TABLE challan_packages (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    challan_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
    package_number VARCHAR(32) NOT NULL,
    package_type VARCHAR(32) NOT NULL DEFAULT 'BOX' CHECK (package_type IN ('BOX', 'PALLET', 'CRATE', 'BAG', 'DRUM', 'CONTAINER')),
    weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    dimensions_cm VARCHAR(64),
    contents_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ix_challan_packages_challan ON challan_packages(challan_id);

CREATE TABLE challan_items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    challan_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
    package_id UUID REFERENCES challan_packages(id) ON DELETE SET NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    hsn_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ix_challan_items_challan ON challan_items(challan_id);
CREATE INDEX ix_challan_items_package ON challan_items(package_id);

DO $spindl_seed$
BEGIN
-- SEED DATA for Tenant '86346062-7d9c-40e4-be16-2007ab592625' (Soof)
INSERT INTO delivery_challans (
    id, tenant_id, challan_number, sales_order_id, customer_id, warehouse_id, status,
    carrier_name, carrier_mode, tracking_number, vehicle_number, driver_name, driver_phone,
    eway_bill_number, eway_bill_valid_till, shipping_address, notes,
    total_packages, total_weight_kg, dispatched_at, delivered_at, pod_recipient_name, pod_notes,
    created_by, created_at, updated_at
) VALUES 
(
    'e1000000-0000-4000-8000-000000000001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'DC-202611-001',
    'dcf9b21f-3557-471c-8a9e-ce940366dc09',
    '6b0529d6-5874-4fd3-b74c-9dd0f4037f6f',
    '8cdd5489-c38c-4e06-86d1-dd833023f906',
    'IN_TRANSIT',
    'Blue Dart Express',
    'ROAD',
    'BD-882910482',
    'MH-04-AX-5512',
    'Ramesh Shinde',
    '+91 98221 44091',
    '2410-8849-2011',
    now() + interval '3 days',
    'Plot 42, MIDC Industrial Area, Bhosari, Pune, MH - 411026',
    'Priority dispatch of precision CNC flanges. Requires hydraulic lift gate on delivery.',
    2,
    32.50,
    now() - interval '4 hours',
    NULL,
    NULL,
    NULL,
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    now() - interval '6 hours',
    now() - interval '4 hours'
),
(
    'e1000000-0000-4000-8000-000000000002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'DC-202611-002',
    'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
    '6b0529d6-5874-4fd3-b74c-9dd0f4037f6f',
    '8cdd5489-c38c-4e06-86d1-dd833023f906',
    'DELIVERED',
    'Delhivery Freight',
    'ROAD',
    'DLV-9938102',
    'KA-01-EQ-9102',
    'Vikas Gaikwad',
    '+91 97182 33490',
    '2410-7719-4401',
    now() - interval '1 day',
    'Plot 42, MIDC Industrial Area, Bhosari, Pune, MH - 411026',
    'Fastener consignment for chassis line assembly.',
    1,
    42.00,
    now() - interval '2 days',
    now() - interval '1 day',
    'Devendra Patil (Gate Incharge)',
    'Verified seal intact, all 200 hex bolts inspected & received in store bin.',
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    now() - interval '3 days',
    now() - interval '1 day'
),
(
    'e1000000-0000-4000-8000-000000000003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'DC-202611-003',
    'fb905062-b2da-41cc-a767-76e1436b06a2',
    'dde1521e-f763-4ed8-b7da-57e45b983ddf',
    '8cdd5489-c38c-4e06-86d1-dd833023f906',
    'PACKED',
    'Spindl Dedicated Fleet',
    'ROAD',
    NULL,
    'MH-12-QZ-4100',
    'Anil Kumar',
    '+91 99201 10293',
    '2410-9921-3819',
    now() + interval '5 days',
    'Sector 7, Sanaswadi Industrial Corridor, Pune, MH - 412208',
    'Heavy engine component sub-assemblies. Secure wooden crates.',
    3,
    58.20,
    NULL,
    NULL,
    NULL,
    NULL,
    'ab060fcc-f1fe-4e32-aa1f-a3a07d21772a',
    now() - interval '1 hour',
    now() - interval '1 hour'
);

-- Seed Packages (Multi-box manifest)
INSERT INTO challan_packages (
    id, tenant_id, challan_id, package_number, package_type, weight_kg, dimensions_cm, contents_summary, created_at
) VALUES
(
    'f1000000-0000-4000-8000-000000000001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000001',
    'BOX 1 of 2',
    'BOX',
    14.50,
    '45 x 30 x 25 cm',
    '8x Machined Aircraft-Grade Aluminum Flange (ALU-FLG-200) with VCI anti-corrosion wrap',
    now() - interval '5 hours'
),
(
    'f1000000-0000-4000-8000-000000000002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000001',
    'BOX 2 of 2',
    'BOX',
    18.00,
    '45 x 30 x 25 cm',
    '7x Machined Aircraft-Grade Aluminum Flange (ALU-FLG-200) with VCI wrap & QC certificate',
    now() - interval '5 hours'
),
(
    'f1000000-0000-4000-8000-000000000003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000002',
    'PALLET 1 of 1',
    'PALLET',
    42.00,
    '100 x 80 x 60 cm',
    '200x High Tensile Grade 8.8 Hex Bolt M12 in master corrugated cartons',
    now() - interval '3 days'
),
(
    'f1000000-0000-4000-8000-000000000004',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000003',
    'CRATE 1 of 3',
    'CRATE',
    20.00,
    '60 x 40 x 40 cm',
    '10x ALU-FLG-200 Heavy Duty Flanges',
    now() - interval '1 hour'
),
(
    'f1000000-0000-4000-8000-000000000005',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000003',
    'CRATE 2 of 3',
    'CRATE',
    20.00,
    '60 x 40 x 40 cm',
    '10x ALU-FLG-200 Heavy Duty Flanges',
    now() - interval '1 hour'
),
(
    'f1000000-0000-4000-8000-000000000006',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000003',
    'CRATE 3 of 3',
    'CRATE',
    18.20,
    '60 x 40 x 40 cm',
    '5x ALU-FLG-200 Heavy Duty Flanges with factory inspection report',
    now() - interval '1 hour'
);

-- Seed Items in Challans
INSERT INTO challan_items (
    id, tenant_id, challan_id, package_id, item_id, quantity, unit_price, hsn_code, created_at
) VALUES
(
    '11000000-0000-4000-8000-000000000001',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'ef9e1f35-28f7-440e-9147-04209b64ea46', -- ALU-FLG-200
    8,
    1850.00,
    '7609.00.00',
    now() - interval '5 hours'
),
(
    '11000000-0000-4000-8000-000000000002',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002',
    'ef9e1f35-28f7-440e-9147-04209b64ea46', -- ALU-FLG-200
    7,
    1850.00,
    '7609.00.00',
    now() - interval '5 hours'
),
(
    '11000000-0000-4000-8000-000000000003',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000003',
    'a7fea5b7-c66c-4da0-bcaa-b365269e4e72', -- HEX-BOLT-M12
    200,
    48.50,
    '7318.15.00',
    now() - interval '3 days'
),
(
    '11000000-0000-4000-8000-000000000004',
    '86346062-7d9c-40e4-be16-2007ab592625',
    'e1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'ef9e1f35-28f7-440e-9147-04209b64ea46', -- ALU-FLG-200
    25,
    1850.00,
    '7609.00.00',
    now() - interval '1 hour'
);
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Skipping demo seed in V77__logistics_dispatch_challans.sql; referenced rows are not present';
END
$spindl_seed$;
