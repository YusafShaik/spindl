package si.spindl.attachments;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface TenantStorageUsageRepository extends JpaRepository<TenantStorageUsageEntity,UUID> {
    @Modifying
    @Query(value="insert into tenant_storage_usage(tenant_id,used_bytes,updated_at) values (:tenantId,0,now()) on conflict(tenant_id) do nothing",nativeQuery=true)
    int ensureRow(@Param("tenantId") UUID tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select usage from TenantStorageUsageEntity usage where usage.tenantId=:tenantId")
    Optional<TenantStorageUsageEntity> findForUpdate(@Param("tenantId") UUID tenantId);
}
