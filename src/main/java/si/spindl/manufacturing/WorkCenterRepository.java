package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface WorkCenterRepository extends JpaRepository<WorkCenterEntity,UUID>{List<WorkCenterEntity> findAllByTenantIdOrderByCode(UUID tenantId);Optional<WorkCenterEntity> findByTenantIdAndId(UUID tenantId,UUID id);boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId,String code);}
