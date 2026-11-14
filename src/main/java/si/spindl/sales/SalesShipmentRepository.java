package si.spindl.sales;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SalesShipmentRepository extends JpaRepository<SalesShipmentEntity,UUID> {
    @EntityGraph(attributePaths={"salesOrder","lines"})
    Optional<SalesShipmentEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
