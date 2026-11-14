package si.spindl.identity;

import tools.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name="tenant_custom_fields")
public class TenantCustomFieldEntity {
    @Id private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="resource_code",nullable=false,length=40) private String resourceCode;
    @Column(name="field_key",nullable=false,length=40) private String fieldKey;
    @Column(name="display_name",nullable=false,length=100) private String displayName;
    @Column(name="field_type",nullable=false,length=16) private String fieldType;
    @Column(nullable=false) private boolean required;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private List<String> options=List.of();
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private Map<String,Object> validation=Map.of();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="default_value",columnDefinition="jsonb") private JsonNode defaultValue;
    @Column(nullable=false) private boolean published;
    @Column(nullable=false) private int version=1;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;

    protected TenantCustomFieldEntity(){}
    public TenantCustomFieldEntity(UUID id,UUID tenantId,String resourceCode,String fieldKey,String displayName,String fieldType,
                                   boolean required,List<String> options,Map<String,Object> validation,JsonNode defaultValue,UUID createdBy){
        this.id=id;this.tenantId=tenantId;this.resourceCode=resourceCode;this.fieldKey=fieldKey;this.displayName=displayName;
        this.fieldType=fieldType;this.required=required;this.options=List.copyOf(options);this.validation=Map.copyOf(validation);
        this.defaultValue=defaultValue;this.createdBy=createdBy;this.updatedAt=Instant.now();
    }
    @PreUpdate void onUpdate(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getResourceCode(){return resourceCode;}
    public String getFieldKey(){return fieldKey;} public String getDisplayName(){return displayName;} public String getFieldType(){return fieldType;}
    public boolean isRequired(){return required;} public List<String> getOptions(){return options;} public Map<String,Object> getValidation(){return validation;}
    public JsonNode getDefaultValue(){return defaultValue;} public boolean isPublished(){return published;} public int getVersion(){return version;}
    public Instant getCreatedAt(){return createdAt;}
    public void publish(){published=true;}
}
