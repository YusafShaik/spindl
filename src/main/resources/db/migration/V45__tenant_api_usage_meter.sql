CREATE TABLE tenant_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usage_month DATE NOT NULL CHECK (EXTRACT(DAY FROM usage_month) = 1),
    request_count BIGINT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_tenant_api_usage_month UNIQUE (tenant_id, usage_month)
);

CREATE FUNCTION spindl_record_api_usage(p_tenant_id UUID, p_usage_month DATE, p_limit BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    recorded_count BIGINT;
BEGIN
    INSERT INTO tenant_api_usage (tenant_id, usage_month, request_count)
    VALUES (p_tenant_id, p_usage_month, 1)
    ON CONFLICT (tenant_id, usage_month) DO UPDATE
        SET request_count = tenant_api_usage.request_count + 1,
            updated_at = now()
        WHERE tenant_api_usage.request_count < p_limit
    RETURNING request_count INTO recorded_count;

    RETURN FOUND;
END;
$$;
