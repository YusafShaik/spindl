package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface WorkOrderMaterialRepository extends JpaRepository<WorkOrderMaterialEntity,UUID>{
    List<WorkOrderMaterialEntity> findAllByTenantIdAndWorkOrderIdOrderById(UUID tenantId,UUID workOrderId);
    Optional<WorkOrderMaterialEntity> findByTenantIdAndWorkOrderIdAndId(UUID tenantId,UUID workOrderId,UUID id);
}
