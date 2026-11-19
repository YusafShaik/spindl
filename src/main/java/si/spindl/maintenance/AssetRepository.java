package si.spindl.maintenance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssetRepository extends JpaRepository<AssetEntity, UUID> {
    List<AssetEntity> findAllByTenantIdOrderByCodeAsc(UUID tenantId);
    Optional<AssetEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId, String code);
    long countByTenantIdAndStatus(UUID tenantId, String status);
}
