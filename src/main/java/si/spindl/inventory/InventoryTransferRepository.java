package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;

public interface InventoryTransferRepository extends JpaRepository<InventoryTransferEntity,UUID> {
    @EntityGraph(attributePaths={"item","sourceWarehouse","destinationWarehouse"})
    Optional<InventoryTransferEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);

    @EntityGraph(attributePaths={"item","sourceWarehouse","destinationWarehouse"})
    List<InventoryTransferEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"item","sourceWarehouse","destinationWarehouse"})
    @Query("select t from InventoryTransferEntity t where t.tenantId=:tenantId and t.id=:id")
    Optional<InventoryTransferEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
