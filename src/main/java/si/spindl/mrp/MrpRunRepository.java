package si.spindl.mrp;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MrpRunRepository extends JpaRepository<MrpRunEntity, UUID> {

    @EntityGraph(attributePaths = {"createdBy"})
    List<MrpRunEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @EntityGraph(attributePaths = {"createdBy", "plannedOrders"})
    Optional<MrpRunEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Query("SELECT r FROM MrpRunEntity r WHERE r.tenantId = :tenantId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<MrpRunEntity> findLatestRun(@Param("tenantId") UUID tenantId);

    long countByTenantId(UUID tenantId);
}
