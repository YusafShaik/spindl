package si.spindl.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovementEntity,UUID>, JpaSpecificationExecutor<InventoryMovementEntity> {
    @EntityGraph(attributePaths={"item","warehouse"})
    Optional<InventoryMovementEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @EntityGraph(attributePaths={"item","warehouse"})
    List<InventoryMovementEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId,Pageable pageable);
}
