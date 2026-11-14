package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantRoleRepository extends JpaRepository<TenantRoleEntity,UUID> {
    List<TenantRoleEntity> findAllByTenantIdOrderBySystemRoleDescDisplayNameAsc(UUID tenantId);
    Optional<TenantRoleEntity> findByTenantIdAndRoleCode(UUID tenantId,String roleCode);
    boolean existsByTenantIdAndRoleCode(UUID tenantId,String roleCode);
}
