package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface TenantMembershipBranchRepository extends JpaRepository<TenantMembershipBranchEntity,UUID> {
    List<TenantMembershipBranchEntity> findAllByTenantIdAndUserId(UUID tenantId,UUID userId);
    List<TenantMembershipBranchEntity> findAllByTenantIdAndUserIdIn(UUID tenantId,List<UUID> userIds);
    boolean existsByTenantIdAndUserIdAndBranchId(UUID tenantId,UUID userId,UUID branchId);
    @Query("select b.branchId from TenantMembershipBranchEntity b where b.tenantId=:tenantId and b.userId=:userId and exists (select branch.id from TenantBranchEntity branch where branch.tenantId=:tenantId and branch.id=b.branchId and branch.active=true)")
    List<UUID> findActiveBranchIds(@Param("tenantId") UUID tenantId,@Param("userId") UUID userId);
    @Query("select count(b)>0 from TenantMembershipBranchEntity b where b.tenantId=:tenantId and b.userId=:userId and b.branchId=:branchId and exists (select branch.id from TenantBranchEntity branch where branch.tenantId=:tenantId and branch.id=b.branchId and branch.active=true)")
    boolean hasActiveAssignment(@Param("tenantId") UUID tenantId,@Param("userId") UUID userId,@Param("branchId") UUID branchId);
    @Modifying @Transactional
    @Query("delete from TenantMembershipBranchEntity b where b.tenantId=:tenantId and b.userId=:userId")
    int deleteAssignments(@Param("tenantId") UUID tenantId,@Param("userId") UUID userId);
}
