package si.spindl.maintenance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MaintenanceScheduleRepository extends JpaRepository<MaintenanceScheduleEntity, UUID> {
    List<MaintenanceScheduleEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<MaintenanceScheduleEntity> findAllByTenantIdAndAssetIdOrderByCreatedAtDesc(UUID tenantId, UUID assetId);
    Optional<MaintenanceScheduleEntity> findByTenantIdAndId(UUID tenantId, UUID id);
}
