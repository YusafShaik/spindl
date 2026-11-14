CREATE UNIQUE INDEX uk_inventory_cycle_count_one_open_per_tenant
    ON inventory_cycle_counts (tenant_id)
    WHERE status IN ('COUNTING', 'REVIEW');
