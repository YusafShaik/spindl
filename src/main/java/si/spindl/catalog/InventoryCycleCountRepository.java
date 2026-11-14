package si.spindl.catalog;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryCycleCountRepository extends JpaRepository<InventoryCycleCountEntity,UUID> {
    @EntityGraph(attributePaths="warehouse") List<InventoryCycleCountEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths="warehouse") List<InventoryCycleCountEntity> findAllByTenantIdAndCreatedByOrderByCreatedAtDesc(UUID tenantId,UUID createdBy);
    @EntityGraph(attributePaths="warehouse") List<InventoryCycleCountEntity> findAllByTenantIdAndCreatedByInOrderByCreatedAtDesc(UUID tenantId,List<UUID> createdBy);
    @EntityGraph(attributePaths="warehouse") @Query("select c from InventoryCycleCountEntity c join c.warehouse w where c.tenantId=:tenantId and w.branchId in :branchIds order by c.createdAt desc") List<InventoryCycleCountEntity> findAllByTenantAndBranchIds(@Param("tenantId") UUID tenantId,@Param("branchIds") List<UUID> branchIds);
    @EntityGraph(attributePaths="warehouse") Optional<InventoryCycleCountEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    boolean existsByTenantIdAndStatusIn(UUID tenantId,List<String> statuses);
    @EntityGraph(attributePaths="warehouse") @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from InventoryCycleCountEntity c where c.tenantId=:tenantId and c.id=:id") Optional<InventoryCycleCountEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
