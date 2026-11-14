CREATE TABLE platform_support_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES app_users(id),
    requester_email VARCHAR(254) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 5 AND 60),
    status VARCHAR(16) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED','REVOKED')),
    expires_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES app_users(id),
    reviewed_at TIMESTAMPTZ,
    review_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uk_platform_support_open_request
    ON platform_support_access_requests(tenant_id) WHERE status='REQUESTED';
CREATE INDEX ix_platform_support_tenant_history
    ON platform_support_access_requests(tenant_id,created_at DESC);
