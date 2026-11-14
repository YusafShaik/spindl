package si.spindl.imports;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="import_batches",uniqueConstraints=@UniqueConstraint(name="uk_import_batches_tenant_resource_key",columnNames={"tenant_id","resource_type","idempotency_key"}))
public class ImportBatchEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="resource_type",nullable=false,length=32) private String resourceType;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="content_sha256",nullable=false,length=64) private String contentSha256;
    @Column(name="rows_imported",nullable=false) private int rowsImported;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected ImportBatchEntity(){}
    public ImportBatchEntity(UUID tenantId,String resourceType,String key,String sha256,int rowsImported){this.tenantId=tenantId;this.resourceType=resourceType;this.idempotencyKey=key;this.contentSha256=sha256;this.rowsImported=rowsImported;}
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getResourceType(){return resourceType;} public String getContentSha256(){return contentSha256;} public int getRowsImported(){return rowsImported;} public Instant getCreatedAt(){return createdAt;}
}
