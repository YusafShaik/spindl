package si.spindl.catalog;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WarehouseStockRepository extends JpaRepository<WarehouseStockEntity,UUID> {
    @Query("select s from WarehouseStockEntity s join fetch s.item where s.tenantId=:tenantId and s.warehouse.id=:warehouseId order by s.item.name")
    List<WarehouseStockEntity> findBalances(@Param("tenantId") UUID tenantId,@Param("warehouseId") UUID warehouseId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from WarehouseStockEntity s where s.tenantId=:tenantId and s.warehouse.id=:warehouseId and s.item.id=:itemId")
    Optional<WarehouseStockEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("warehouseId") UUID warehouseId,@Param("itemId") UUID itemId);
    @Query("select s from WarehouseStockEntity s where s.tenantId=:tenantId and s.warehouse.id=:warehouseId and s.item.id=:itemId")
    Optional<WarehouseStockEntity> findByLocationAndItem(@Param("tenantId") UUID tenantId,@Param("warehouseId") UUID warehouseId,@Param("itemId") UUID itemId);
    @Query("select s from WarehouseStockEntity s join fetch s.warehouse where s.tenantId=:tenantId and s.item.id=:itemId order by s.warehouse.isDefault desc,s.warehouse.name")
    List<WarehouseStockEntity> findAllByTenantAndItem(@Param("tenantId") UUID tenantId,@Param("itemId") UUID itemId);
}
