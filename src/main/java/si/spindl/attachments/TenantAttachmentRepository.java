package si.spindl.attachments;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantAttachmentRepository extends JpaRepository<TenantAttachmentEntity,UUID> {
    List<TenantAttachmentEntity> findAllByTenantIdAndResourceCodeAndRecordIdOrderByUploadedAtDesc(UUID tenantId,String resourceCode,UUID recordId);
    Optional<TenantAttachmentEntity> findByTenantIdAndResourceCodeAndRecordIdAndId(UUID tenantId,String resourceCode,UUID recordId,UUID id);
    Optional<TenantAttachmentEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    long countByTenantId(UUID tenantId);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value="update tenant_attachments set record_id=:targetId where tenant_id=:tenantId and resource_code='customers' and record_id=:sourceId",nativeQuery=true)
    int moveCustomerAttachments(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,@org.springframework.data.repository.query.Param("sourceId") UUID sourceId,@org.springframework.data.repository.query.Param("targetId") UUID targetId);
}
