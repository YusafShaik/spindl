package si.spindl.purchasing;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface GoodsReceiptRepository extends JpaRepository<GoodsReceiptEntity,UUID> {
    @EntityGraph(attributePaths={"purchaseOrder","lines"})
    Optional<GoodsReceiptEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
