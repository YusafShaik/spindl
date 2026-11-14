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

public interface PurchaseRequisitionRepository extends JpaRepository<PurchaseRequisitionEntity,UUID> {
    @EntityGraph(attributePaths={"lines","lines.item","purchaseOrder"})
    List<PurchaseRequisitionEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"lines","lines.item","purchaseOrder"})
    Optional<PurchaseRequisitionEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @EntityGraph(attributePaths={"lines","lines.item","purchaseOrder"})
    Optional<PurchaseRequisitionEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PurchaseRequisitionEntity r where r.tenantId=:tenantId and r.id=:id")
    Optional<PurchaseRequisitionEntity> findForUpdate(@Param("tenantId")UUID tenantId,@Param("id")UUID id);
}
