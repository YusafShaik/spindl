package si.spindl.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryCycleCountLineRepository extends JpaRepository<InventoryCycleCountLineEntity,UUID> {
    List<InventoryCycleCountLineEntity> findAllByTenantIdAndCycleCountIdOrderBySkuAsc(UUID tenantId,UUID cycleCountId);
    Optional<InventoryCycleCountLineEntity> findByTenantIdAndCycleCountIdAndId(UUID tenantId,UUID cycleCountId,UUID id);
}
