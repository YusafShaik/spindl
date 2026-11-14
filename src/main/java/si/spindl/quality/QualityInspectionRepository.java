package si.spindl.quality;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface QualityInspectionRepository extends JpaRepository<QualityInspectionEntity,UUID> {
    Optional<QualityInspectionEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
