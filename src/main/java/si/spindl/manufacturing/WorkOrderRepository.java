package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface WorkOrderRepository extends JpaRepository<WorkOrderEntity,UUID>{
    List<WorkOrderEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Page<WorkOrderEntity> findPageByTenantIdOrderByCreatedAtDesc(UUID tenantId,Pageable pageable);
    Optional<WorkOrderEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select w from WorkOrderEntity w where w.tenantId=:tenantId and w.id=:id") Optional<WorkOrderEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
