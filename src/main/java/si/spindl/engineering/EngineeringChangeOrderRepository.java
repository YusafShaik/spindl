package si.spindl.engineering;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EngineeringChangeOrderRepository extends JpaRepository<EngineeringChangeOrderEntity, UUID> {

    @EntityGraph(attributePaths = {"finishedItem", "baseBom", "implementedBom", "createdBy"})
    List<EngineeringChangeOrderEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    @EntityGraph(attributePaths = {"finishedItem", "baseBom", "implementedBom", "createdBy"})
    Optional<EngineeringChangeOrderEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM EngineeringChangeOrderEntity e WHERE e.tenantId = :tenantId AND e.id = :id")
    Optional<EngineeringChangeOrderEntity> findForUpdate(@Param("tenantId") UUID tenantId, @Param("id") UUID id);

    boolean existsByTenantIdAndEcoNumber(UUID tenantId, String ecoNumber);

    long countByTenantId(UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, String status);
}
