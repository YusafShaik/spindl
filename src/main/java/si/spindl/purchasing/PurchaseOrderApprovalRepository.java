package si.spindl.purchasing;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseOrderApprovalRepository extends JpaRepository<PurchaseOrderApprovalEntity, UUID> {
    Optional<PurchaseOrderApprovalEntity> findByTenantIdAndPurchaseOrderIdAndApproverUserId(UUID tenantId, UUID purchaseOrderId, UUID approverUserId);
    long countByTenantIdAndPurchaseOrderId(UUID tenantId, UUID purchaseOrderId);
}
