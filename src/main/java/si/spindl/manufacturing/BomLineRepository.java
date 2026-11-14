package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface BomLineRepository extends JpaRepository<BomLineEntity,UUID>{List<BomLineEntity> findAllByTenantIdAndBomIdOrderById(UUID tenantId,UUID bomId);}
