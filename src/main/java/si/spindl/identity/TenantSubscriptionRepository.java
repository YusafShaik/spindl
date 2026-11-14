package si.spindl.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface TenantSubscriptionRepository extends JpaRepository<TenantSubscriptionEntity,UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from TenantSubscriptionEntity s where s.tenantId=:tenantId")
    Optional<TenantSubscriptionEntity> findByTenantIdForUpdate(@Param("tenantId") UUID tenantId);
    Optional<TenantSubscriptionEntity> findByTenantId(UUID tenantId);
}
