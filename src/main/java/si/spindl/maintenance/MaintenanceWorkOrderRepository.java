package si.spindl.maintenance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MaintenanceWorkOrderRepository extends JpaRepository<MaintenanceWorkOrderEntity, UUID> {
    List<MaintenanceWorkOrderEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Optional<MaintenanceWorkOrderEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    Optional<MaintenanceWorkOrderEntity> findByTenantIdAndOrderNumber(UUID tenantId, String orderNumber);
    long countByTenantIdAndStatusIn(UUID tenantId, List<String> statuses);
    long countByTenantIdAndPriorityAndStatusIn(UUID tenantId, String priority, List<String> statuses);
    List<MaintenanceWorkOrderEntity> findAllByTenantIdAndStatus(UUID tenantId, String status);
}
