package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface BomOperationRepository extends JpaRepository<BomOperationEntity,UUID>{List<BomOperationEntity> findAllByTenantIdAndBomIdOrderBySequenceAsc(UUID tenantId,UUID bomId);}
