package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantPlanChangeRequestRepository extends JpaRepository<TenantPlanChangeRequestEntity,UUID> {
    List<TenantPlanChangeRequestEntity> findAllByTenantIdOrderByRequestedAtDesc(UUID tenantId);
    Optional<TenantPlanChangeRequestEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TenantPlanChangeRequestEntity r where r.tenantId=:tenantId and r.id=:id")
    Optional<TenantPlanChangeRequestEntity> findByTenantIdAndIdForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    boolean existsByTenantIdAndStatus(UUID tenantId,String status);
    boolean existsByTenantIdAndStatusIn(UUID tenantId,List<String> statuses);
    List<TenantPlanChangeRequestEntity> findAllByStatusInOrderByRequestedAtAsc(List<String> statuses);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TenantPlanChangeRequestEntity r where r.status='APPROVED' and r.effectiveDate<=:today order by r.effectiveDate asc")
    List<TenantPlanChangeRequestEntity> findDueApprovedForUpdate(@Param("today") LocalDate today);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TenantPlanChangeRequestEntity r where r.id=:id")
    Optional<TenantPlanChangeRequestEntity> findByIdForUpdate(@Param("id") UUID id);
}
