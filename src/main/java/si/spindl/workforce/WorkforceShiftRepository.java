package si.spindl.workforce;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkforceShiftRepository extends JpaRepository<WorkforceShiftEntity, UUID> {
    List<WorkforceShiftEntity> findAllByTenantIdOrderByStartTimeAsc(UUID tenantId);
    Optional<WorkforceShiftEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    Optional<WorkforceShiftEntity> findByTenantIdAndShiftCode(UUID tenantId, String shiftCode);
    boolean existsByTenantIdAndShiftCode(UUID tenantId, String shiftCode);
}
