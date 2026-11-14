package si.spindl.attachments;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="tenant_attachments")
public class TenantAttachmentEntity {
    @Id private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="resource_code",nullable=false,length=40) private String resourceCode;
    @Column(name="record_id",nullable=false) private UUID recordId;
    @Column(name="original_filename",nullable=false,length=255) private String originalFilename;
    @Column(name="media_type",nullable=false,length=100) private String mediaType;
    @Column(name="size_bytes",nullable=false) private long sizeBytes;
    @Column(nullable=false,length=64) private String sha256;
    @Column(name="storage_key",nullable=false,length=80) private String storageKey;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="scan_status",nullable=false,length=16) private String scanStatus="CLEAN";
    @Column(name="uploaded_by",nullable=false) private UUID uploadedBy;
    @CreationTimestamp @Column(name="uploaded_at",nullable=false,updatable=false) private Instant uploadedAt;
    protected TenantAttachmentEntity(){}
    public TenantAttachmentEntity(UUID id,UUID tenantId,String resourceCode,UUID recordId,String originalFilename,String mediaType,long sizeBytes,String sha256,String storageKey,String idempotencyKey,UUID uploadedBy){this.id=id;this.tenantId=tenantId;this.resourceCode=resourceCode;this.recordId=recordId;this.originalFilename=originalFilename;this.mediaType=mediaType;this.sizeBytes=sizeBytes;this.sha256=sha256;this.storageKey=storageKey;this.idempotencyKey=idempotencyKey;this.uploadedBy=uploadedBy;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getResourceCode(){return resourceCode;}public UUID getRecordId(){return recordId;}public String getOriginalFilename(){return originalFilename;}public String getMediaType(){return mediaType;}public long getSizeBytes(){return sizeBytes;}public String getSha256(){return sha256;}public String getStorageKey(){return storageKey;}public String getScanStatus(){return scanStatus;}public UUID getUploadedBy(){return uploadedBy;}public Instant getUploadedAt(){return uploadedAt;}
}
