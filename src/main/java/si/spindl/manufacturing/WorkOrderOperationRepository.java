package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface WorkOrderOperationRepository extends JpaRepository<WorkOrderOperationEntity,UUID>{
    List<WorkOrderOperationEntity> findAllByTenantIdAndWorkOrderIdOrderBySequenceAsc(UUID tenantId,UUID workOrderId);
    List<WorkOrderOperationEntity> findAllByTenantIdAndWorkCenterIdAndStatusInOrderBySequenceAsc(UUID tenantId,UUID workCenterId,List<String> statuses);
    Optional<WorkOrderOperationEntity> findByTenantIdAndWorkOrderIdAndId(UUID tenantId,UUID workOrderId,UUID id);
    Optional<WorkOrderOperationEntity> findByTenantIdAndCompletionKey(UUID tenantId,String completionKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select o from WorkOrderOperationEntity o where o.tenantId=:tenantId and o.workOrderId=:workOrderId and o.id=:id") Optional<WorkOrderOperationEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("workOrderId") UUID workOrderId,@Param("id") UUID id);
}
