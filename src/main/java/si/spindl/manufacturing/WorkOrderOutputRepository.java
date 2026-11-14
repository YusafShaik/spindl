package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface WorkOrderOutputRepository extends JpaRepository<WorkOrderOutputEntity,UUID>{Optional<WorkOrderOutputEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);}
