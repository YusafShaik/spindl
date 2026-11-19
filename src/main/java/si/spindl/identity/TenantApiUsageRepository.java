package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.UUID;

public interface TenantApiUsageRepository extends JpaRepository<TenantApiUsageEntity,UUID> {
    @Query(value="select spindl_record_api_usage(:tenantId,:usageMonth,:requestLimit)",nativeQuery=true)
    boolean recordIfBelowLimit(@Param("tenantId") UUID tenantId,@Param("usageMonth") LocalDate usageMonth,@Param("requestLimit") long requestLimit);

    @Query(value="select coalesce((select request_count from tenant_api_usage where tenant_id=:tenantId and usage_month=:usageMonth),0)",nativeQuery=true)
    long countForMonth(@Param("tenantId") UUID tenantId,@Param("usageMonth") LocalDate usageMonth);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query(value="INSERT INTO tenant_api_usage (tenant_id, usage_month, request_count, updated_at) VALUES (:tenantId, :usageMonth, :delta, now()) ON CONFLICT (tenant_id, usage_month) DO UPDATE SET request_count = tenant_api_usage.request_count + :delta, updated_at = now()", nativeQuery=true)
    int addBatchUsage(@Param("tenantId") UUID tenantId, @Param("usageMonth") LocalDate usageMonth, @Param("delta") long delta);
}
