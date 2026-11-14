package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface BomRevisionEventRepository extends JpaRepository<BomRevisionEventEntity,UUID>{List<BomRevisionEventEntity> findAllByTenantIdAndBomIdOrderByCreatedAtDesc(UUID tenantId,UUID bomId);}
