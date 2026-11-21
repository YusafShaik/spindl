package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WarehouseRepository extends JpaRepository<WarehouseEntity,UUID> {
    List<WarehouseEntity> findAllByTenantIdAndActiveTrueOrderByIsDefaultDescNameAsc(UUID tenantId);
    Optional<WarehouseEntity> findByTenantIdAndIdAndActiveTrue(UUID tenantId,UUID id);
    Optional<WarehouseEntity> findByTenantIdAndIsDefaultTrueAndActiveTrue(UUID tenantId);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId,String code);
}
