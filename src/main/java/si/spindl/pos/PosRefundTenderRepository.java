package si.spindl.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PosRefundTenderRepository extends JpaRepository<PosRefundTenderEntity,UUID> {
    List<PosRefundTenderEntity> findAllByTenantIdAndRefundId(UUID tenantId,UUID refundId);
}
