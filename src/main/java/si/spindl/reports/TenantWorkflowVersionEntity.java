package si.spindl.reports;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity @Table(name="tenant_workflow_versions",uniqueConstraints=@UniqueConstraint(name="uk_tenant_workflow_version",columnNames={"tenant_id","workflow_key","version"}))
public class TenantWorkflowVersionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="workflow_key",nullable=false,length=48) private String workflowKey;
    @Column(nullable=false) private int version;
    @Column(nullable=false,length=16) private String status="DRAFT";
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private Map<String,Object> configuration;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="published_at") private Instant publishedAt;
    protected TenantWorkflowVersionEntity(){}
    public TenantWorkflowVersionEntity(UUID tenantId,String key,int version,Map<String,Object> configuration,UUID createdBy){this.tenantId=tenantId;this.workflowKey=key;this.version=version;this.configuration=Map.copyOf(configuration);this.createdBy=createdBy;}
    public void updateDraft(Map<String,Object> configuration){if(!"DRAFT".equals(status))throw new IllegalStateException("Published workflow versions are immutable");this.configuration=Map.copyOf(configuration);}
    public void publish(){if(!"DRAFT".equals(status))throw new IllegalStateException("Only draft workflow versions can be published");status="PUBLISHED";publishedAt=Instant.now();}
    public void rollback(){if(!"PUBLISHED".equals(status))throw new IllegalStateException("Only published workflow versions can be rolled back");status="ROLLED_BACK";}
    public void republish(){if(!"ROLLED_BACK".equals(status))throw new IllegalStateException("Only rolled-back versions can be restored");status="PUBLISHED";publishedAt=Instant.now();}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getWorkflowKey(){return workflowKey;}public int getVersion(){return version;}public String getStatus(){return status;}public Map<String,Object> getConfiguration(){return configuration;}public UUID getCreatedBy(){return createdBy;}public Instant getCreatedAt(){return createdAt;}public Instant getPublishedAt(){return publishedAt;}
}
