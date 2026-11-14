package si.spindl.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface TenantOwnershipTransferRepository extends JpaRepository<TenantOwnershipTransferEntity, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TenantOwnershipTransferEntity t where t.tokenHash=:hash")
    Optional<TenantOwnershipTransferEntity> findByTokenHashForUpdate(@Param("hash") String hash);
    @org.springframework.data.jpa.repository.Modifying
    @Query("update TenantOwnershipTransferEntity t set t.cancelledAt=current_timestamp where t.tenantId=:tenantId and t.acceptedAt is null and t.cancelledAt is null and t.expiresAt<=current_timestamp")
    int cancelExpired(@Param("tenantId") UUID tenantId);
    boolean existsByTenantIdAndAcceptedAtIsNullAndCancelledAtIsNull(UUID tenantId);
}
