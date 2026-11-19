package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface TenantMembershipRepository extends JpaRepository<TenantMembershipEntity, UUID> {
    Optional<TenantMembershipEntity> findFirstByUserIdAndActiveTrueOrderByCreatedAtAsc(UUID userId);
    Optional<TenantMembershipEntity> findByTenantIdAndUserIdAndActiveTrue(UUID tenantId, UUID userId);
    List<TenantMembershipEntity> findAllByUserIdAndActiveTrue(UUID userId);
    @Query("select m.role from TenantMembershipEntity m where m.tenantId = :tenantId and m.userId = :userId and m.active = true")
    Optional<String> findActiveRole(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
    Optional<TenantMembershipEntity> findByTenantIdAndUserId(UUID tenantId,UUID userId);
    List<TenantMembershipEntity> findAllByTenantIdOrderByCreatedAtAsc(UUID tenantId);
    List<TenantMembershipEntity> findAllByTenantIdAndManagerUserIdAndActiveTrueOrderByCreatedAtAsc(UUID tenantId,UUID managerUserId);
    List<TenantMembershipEntity> findAllByTenantIdAndRoleAndActiveTrueOrderByCreatedAtAsc(UUID tenantId, String role);
    Optional<TenantMembershipEntity> findByIdAndTenantId(UUID id, UUID tenantId);
    boolean existsByTenantIdAndUserId(UUID tenantId, UUID userId);
    long countByTenantIdAndRoleInAndActiveTrue(UUID tenantId, java.util.Collection<String> roles);
    long countByTenantIdAndActiveTrue(UUID tenantId);
    long countByTenantIdAndRoleAndActiveTrue(UUID tenantId,String role);
    boolean existsByTenantIdAndRole(UUID tenantId,String role);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from TenantMembershipEntity m where m.tenantId=:tenantId order by m.createdAt")
    List<TenantMembershipEntity> findAllForUpdate(@Param("tenantId") UUID tenantId);
}
