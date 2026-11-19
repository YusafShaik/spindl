package si.spindl.workforce;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkforceRosterAssignmentRepository extends JpaRepository<WorkforceRosterAssignmentEntity, UUID> {

    List<WorkforceRosterAssignmentEntity> findAllByTenantIdAndRosterDateOrderByShiftStartTimeAsc(UUID tenantId, LocalDate rosterDate);

    @Query("SELECT r FROM WorkforceRosterAssignmentEntity r WHERE r.tenantId = :tenantId AND r.rosterDate >= :startDate AND r.rosterDate <= :endDate ORDER BY r.rosterDate ASC, r.shift.startTime ASC")
    List<WorkforceRosterAssignmentEntity> findRosterBetween(
            @Param("tenantId") UUID tenantId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    Optional<WorkforceRosterAssignmentEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    Optional<WorkforceRosterAssignmentEntity> findByTenantIdAndUserIdAndRosterDate(UUID tenantId, UUID userId, LocalDate rosterDate);

    @Query("SELECT COUNT(r) FROM WorkforceRosterAssignmentEntity r WHERE r.tenantId = :tenantId AND r.rosterDate = :today AND r.attendanceStatus = 'PRESENT'")
    long countPresentOperatorsToday(@Param("tenantId") UUID tenantId, @Param("today") LocalDate today);

    @Query("SELECT COUNT(r) FROM WorkforceRosterAssignmentEntity r WHERE r.tenantId = :tenantId AND r.rosterDate = :today")
    long countScheduledOperatorsToday(@Param("tenantId") UUID tenantId, @Param("today") LocalDate today);
}
