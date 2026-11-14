package si.spindl.identity;

import tools.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="tenant_custom_field_values")
public class TenantCustomFieldValueEntity {
    @Id private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="resource_code",nullable=false,length=40) private String resourceCode;
    @Column(name="record_id",nullable=false) private UUID recordId;
    @Column(name="field_id",nullable=false) private UUID fieldId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="field_value",nullable=false,columnDefinition="jsonb") private JsonNode value;
    @Column(name="updated_by",nullable=false) private UUID updatedBy;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantCustomFieldValueEntity(){}
    public TenantCustomFieldValueEntity(UUID tenantId,String resourceCode,UUID recordId,UUID fieldId,JsonNode value,UUID updatedBy){
        this.id=UUID.randomUUID();this.tenantId=tenantId;this.resourceCode=resourceCode;this.recordId=recordId;
        this.fieldId=fieldId;this.value=value;this.updatedBy=updatedBy;this.updatedAt=Instant.now();
    }
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getResourceCode(){return resourceCode;}
    public UUID getRecordId(){return recordId;} public UUID getFieldId(){return fieldId;} public JsonNode getValue(){return value;}
    public UUID getUpdatedBy(){return updatedBy;} public Instant getUpdatedAt(){return updatedAt;}
}
