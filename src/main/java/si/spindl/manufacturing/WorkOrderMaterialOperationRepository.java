package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface WorkOrderMaterialOperationRepository extends JpaRepository<WorkOrderMaterialOperationEntity,UUID>{Optional<WorkOrderMaterialOperationEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    java.util.List<WorkOrderMaterialOperationEntity> findAllByTenantIdAndWorkOrderIdOrderByCreatedAtAsc(UUID tenantId,UUID workOrderId);}
