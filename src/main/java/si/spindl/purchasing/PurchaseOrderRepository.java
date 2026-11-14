package si.spindl.purchasing;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrderEntity,UUID> {
    long countByTenantId(UUID tenantId);
    @EntityGraph(attributePaths={"supplier","lines","lines.item"})
    List<PurchaseOrderEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"supplier","lines","lines.item"})
    Optional<PurchaseOrderEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select po from PurchaseOrderEntity po where po.tenantId=:tenantId and po.id=:id")
    Optional<PurchaseOrderEntity> findForUpdateByTenantIdAndId(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
