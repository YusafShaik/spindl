package si.spindl.mrp;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MrpPlannedOrderRepository extends JpaRepository<MrpPlannedOrderEntity, UUID> {

    @EntityGraph(attributePaths = {"mrpRun", "item", "bom", "suggestedSupplier"})
    List<MrpPlannedOrderEntity> findAllByTenantIdOrderByRequiredByDateAsc(UUID tenantId);

    @EntityGraph(attributePaths = {"mrpRun", "item", "bom", "suggestedSupplier"})
    List<MrpPlannedOrderEntity> findAllByTenantIdAndMrpRunIdOrderByRequiredByDateAsc(UUID tenantId, UUID runId);

    @EntityGraph(attributePaths = {"mrpRun", "item", "bom", "suggestedSupplier"})
    List<MrpPlannedOrderEntity> findAllByTenantIdAndStatusOrderByRequiredByDateAsc(UUID tenantId, String status);

    @EntityGraph(attributePaths = {"mrpRun", "item", "bom", "suggestedSupplier"})
    Optional<MrpPlannedOrderEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    long countByTenantIdAndStatus(UUID tenantId, String status);

    long countByTenantIdAndActionTypeAndStatus(UUID tenantId, String actionType, String status);

    @Query("SELECT coalesce(SUM(o.estimatedTotalCost), 0) FROM MrpPlannedOrderEntity o WHERE o.tenantId = :tenantId AND o.status = 'PENDING'")
    java.math.BigDecimal calculateTotalPendingSpend(@Param("tenantId") UUID tenantId);
}
