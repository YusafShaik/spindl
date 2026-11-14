package si.spindl.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlatformSupportAccessRequestRepository extends JpaRepository<PlatformSupportAccessRequestEntity,UUID> {
    List<PlatformSupportAccessRequestEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<PlatformSupportAccessRequestEntity> findAllByStatusInOrderByCreatedAtAsc(List<String> statuses);
    boolean existsByTenantIdAndStatus(UUID tenantId,String status);
    boolean existsByTenantIdAndStatusAndExpiresAtAfter(UUID tenantId,String status,java.time.Instant now);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PlatformSupportAccessRequestEntity r where r.tenantId=:tenantId and r.id=:id")
    Optional<PlatformSupportAccessRequestEntity> findByTenantIdAndIdForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PlatformSupportAccessRequestEntity r where r.id=:id")
    Optional<PlatformSupportAccessRequestEntity> findByIdForUpdate(@Param("id") UUID id);
}
