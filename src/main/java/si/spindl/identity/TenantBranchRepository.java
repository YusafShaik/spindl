package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantBranchRepository extends JpaRepository<TenantBranchEntity,UUID> {
    List<TenantBranchEntity> findAllByTenantIdOrderByDefaultBranchDescNameAsc(UUID tenantId);
    List<TenantBranchEntity> findAllByTenantIdAndActiveTrueOrderByDefaultBranchDescNameAsc(UUID tenantId);
    Optional<TenantBranchEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<TenantBranchEntity> findFirstByTenantIdAndDefaultBranchTrue(UUID tenantId);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId,String code);
}
