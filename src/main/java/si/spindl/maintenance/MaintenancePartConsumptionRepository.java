package si.spindl.maintenance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MaintenancePartConsumptionRepository extends JpaRepository<MaintenancePartConsumptionEntity, UUID> {
    List<MaintenancePartConsumptionEntity> findAllByTenantIdAndWorkOrderId(UUID tenantId, UUID workOrderId);
    List<MaintenancePartConsumptionEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
