CREATE TABLE tenant_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_code VARCHAR(40) NOT NULL,
    field_key VARCHAR(40) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(16) NOT NULL CHECK (field_type IN ('TEXT','NUMBER','DATE','BOOLEAN','SELECT','REFERENCE')),
    required BOOLEAN NOT NULL DEFAULT FALSE,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_value JSONB,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_custom_field_tenant_resource_key UNIQUE(tenant_id,resource_code,field_key),
    CONSTRAINT uk_custom_field_tenant_id UNIQUE(tenant_id,id)
);

CREATE TABLE tenant_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_code VARCHAR(40) NOT NULL,
    record_id UUID NOT NULL,
    field_id UUID NOT NULL,
    field_value JSONB NOT NULL,
    updated_by UUID NOT NULL REFERENCES app_users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_custom_field_value_definition FOREIGN KEY(tenant_id,field_id)
        REFERENCES tenant_custom_fields(tenant_id,id) ON DELETE CASCADE,
    CONSTRAINT uk_custom_field_value_record UNIQUE(tenant_id,resource_code,record_id,field_id)
);
CREATE INDEX ix_custom_field_values_record ON tenant_custom_field_values(tenant_id,resource_code,record_id);
