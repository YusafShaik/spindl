package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;

public interface TenantModuleEntitlementRepository extends JpaRepository<TenantModuleEntitlementEntity, UUID> {
    List<TenantModuleEntitlementEntity> findAllByTenantIdOrderByModuleCodeAsc(UUID tenantId);
    Optional<TenantModuleEntitlementEntity> findByTenantIdAndModuleCode(UUID tenantId, String moduleCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from TenantModuleEntitlementEntity m where m.tenantId=:tenantId order by m.moduleCode")
    List<TenantModuleEntitlementEntity> findAllForUpdate(@Param("tenantId") UUID tenantId);

    @Query("select count(m) > 0 from TenantModuleEntitlementEntity m where m.tenantId=:tenantId and m.moduleCode=:moduleCode and m.enabled=true and m.entitled=true")
    boolean isEnabledAndEntitled(@Param("tenantId") UUID tenantId, @Param("moduleCode") String moduleCode);
}
