-- V83: Clean and simplify 3rd-party logistics data, removing driver/fleet placeholders
UPDATE delivery_challans
SET carrier_name = 'Safexpress Logistics',
    tracking_number = 'SFX-9941028',
    vehicle_number = NULL,
    driver_name = NULL,
    driver_phone = NULL
WHERE challan_number = 'DC-202611-003';

UPDATE delivery_challans
SET vehicle_number = NULL,
    driver_name = NULL,
    driver_phone = NULL
WHERE tenant_id IS NOT NULL;
