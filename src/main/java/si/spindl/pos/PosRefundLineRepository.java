package si.spindl.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PosRefundLineRepository extends JpaRepository<PosRefundLineEntity,UUID> {
    List<PosRefundLineEntity> findAllByTenantIdAndRefundId(UUID tenantId,UUID refundId);
}
