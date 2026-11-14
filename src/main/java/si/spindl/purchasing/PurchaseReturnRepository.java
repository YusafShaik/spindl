package si.spindl.purchasing;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturnEntity,UUID> {
    @EntityGraph(attributePaths={"purchaseOrder"})
    Optional<PurchaseReturnEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
