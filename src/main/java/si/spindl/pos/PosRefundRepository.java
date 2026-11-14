package si.spindl.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosRefundRepository extends JpaRepository<PosRefundEntity,UUID> {
    Optional<PosRefundEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    List<PosRefundEntity> findAllByTenantIdAndSaleIdOrderByCreatedAtDesc(UUID tenantId,UUID saleId);
}
