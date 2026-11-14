package si.spindl.manufacturing;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface WorkOrderReworkDispositionRepository extends JpaRepository<WorkOrderReworkDispositionEntity,UUID> {
    Optional<WorkOrderReworkDispositionEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
