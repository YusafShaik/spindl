package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface TenantRolePermissionRepository extends JpaRepository<TenantRolePermissionEntity, UUID> {
    java.util.List<TenantRolePermissionEntity> findAllByTenantIdOrderByRoleAscModuleAscResourceAscActionAsc(UUID tenantId);
    java.util.List<TenantRolePermissionEntity> findAllByTenantIdAndRoleOrderByModuleAscResourceAscActionAsc(UUID tenantId,String role);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    long deleteAllByTenantIdAndRole(UUID tenantId,String role);
    @Query("select count(p) > 0 from TenantRolePermissionEntity p where p.tenantId = :tenantId and p.role = :role " +
            "and p.permissionScope = :scope and p.module in ('*', :module) and p.resource in ('*', :resource) and p.action in ('*', :action)")
    boolean allows(@Param("tenantId") UUID tenantId, @Param("role") String role,
                   @Param("module") String module, @Param("resource") String resource, @Param("action") String action,@Param("scope") String scope);
}
