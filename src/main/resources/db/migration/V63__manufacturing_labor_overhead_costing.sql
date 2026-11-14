ALTER TABLE work_centers
    ADD COLUMN labor_rate_per_hour NUMERIC(14,4) NOT NULL DEFAULT 0,
    ADD COLUMN overhead_rate_per_hour NUMERIC(14,4) NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_work_center_labor_rate CHECK (labor_rate_per_hour >= 0),
    ADD CONSTRAINT ck_work_center_overhead_rate CHECK (overhead_rate_per_hour >= 0);

ALTER TABLE work_order_operations
    ADD COLUMN labor_rate_per_hour NUMERIC(14,4) NOT NULL DEFAULT 0,
    ADD COLUMN overhead_rate_per_hour NUMERIC(14,4) NOT NULL DEFAULT 0,
    ADD COLUMN labor_cost_amount NUMERIC(14,2),
    ADD COLUMN overhead_cost_amount NUMERIC(14,2),
    ADD CONSTRAINT ck_work_order_operation_cost CHECK (
        labor_rate_per_hour >= 0 AND overhead_rate_per_hour >= 0
        AND (labor_cost_amount IS NULL OR labor_cost_amount >= 0)
        AND (overhead_cost_amount IS NULL OR overhead_cost_amount >= 0)
    );
