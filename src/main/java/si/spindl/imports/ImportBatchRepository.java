package si.spindl.imports;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportBatchRepository extends JpaRepository<ImportBatchEntity,UUID> {
    Optional<ImportBatchEntity> findByTenantIdAndResourceTypeAndIdempotencyKey(UUID tenantId,String resourceType,String idempotencyKey);
    List<ImportBatchEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
