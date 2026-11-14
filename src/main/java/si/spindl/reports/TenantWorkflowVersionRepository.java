package si.spindl.reports;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantWorkflowVersionRepository extends JpaRepository<TenantWorkflowVersionEntity,UUID> {
    List<TenantWorkflowVersionEntity> findAllByTenantIdAndWorkflowKeyOrderByVersionDesc(UUID tenantId,String workflowKey);
    Optional<TenantWorkflowVersionEntity> findFirstByTenantIdAndWorkflowKeyAndStatusOrderByVersionDesc(UUID tenantId,String workflowKey,String status);
    boolean existsByTenantIdAndWorkflowKeyAndStatus(UUID tenantId,String workflowKey,String status);
    @Query("select coalesce(max(w.version),0) from TenantWorkflowVersionEntity w where w.tenantId=:tenantId and w.workflowKey=:workflowKey") int findMaxVersion(@Param("tenantId") UUID tenantId,@Param("workflowKey") String workflowKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select w from TenantWorkflowVersionEntity w where w.tenantId=:tenantId and w.id=:id") Optional<TenantWorkflowVersionEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
