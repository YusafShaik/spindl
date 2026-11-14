package si.spindl.reports;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavedReportScheduleRepository extends JpaRepository<SavedReportScheduleEntity,UUID> {
    List<SavedReportScheduleEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    Optional<SavedReportScheduleEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<SavedReportScheduleEntity> findByTenantIdAndReportId(UUID tenantId,UUID reportId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select schedule from SavedReportScheduleEntity schedule where schedule.enabled=true and schedule.nextRunAt<=:now order by schedule.nextRunAt")
    List<SavedReportScheduleEntity> lockDue(@Param("now") Instant now,Pageable pageable);
}
