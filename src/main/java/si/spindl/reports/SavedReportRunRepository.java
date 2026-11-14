package si.spindl.reports;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

public interface SavedReportRunRepository extends JpaRepository<SavedReportRunEntity,UUID> {
    List<SavedReportRunEntity> findAllByTenantIdAndScheduleIdOrderByCompletedAtDesc(UUID tenantId,UUID scheduleId,Pageable pageable);
    @Modifying @Transactional
    @Query(value="DELETE FROM tenant_saved_report_runs WHERE tenant_id=:tenantId AND schedule_id=:scheduleId AND id NOT IN (SELECT id FROM tenant_saved_report_runs WHERE tenant_id=:tenantId AND schedule_id=:scheduleId ORDER BY completed_at DESC LIMIT 100)",nativeQuery=true)
    int pruneHistory(@Param("tenantId") UUID tenantId,@Param("scheduleId") UUID scheduleId);
}
