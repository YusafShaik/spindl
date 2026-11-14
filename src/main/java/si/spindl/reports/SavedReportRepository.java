package si.spindl.reports;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavedReportRepository extends JpaRepository<SavedReportEntity,UUID> {
    List<SavedReportEntity> findAllByTenantIdOrderByUpdatedAtDesc(UUID tenantId);
    Optional<SavedReportEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    boolean existsByTenantIdAndNameIgnoreCase(UUID tenantId,String name);
}
