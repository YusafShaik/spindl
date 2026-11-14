package si.spindl.crm;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<LeadEntity,UUID> {
    @Query("select distinct l.stage from LeadEntity l where l.tenantId=:tenantId") List<String> findDistinctStagesByTenantId(@Param("tenantId") UUID tenantId);
    List<LeadEntity> findAllByTenantIdOrderByUpdatedAtDesc(UUID tenantId);
    List<LeadEntity> findAllByTenantIdAndOwnerUserIdOrderByUpdatedAtDesc(UUID tenantId,UUID ownerUserId);
    List<LeadEntity> findAllByTenantIdAndOwnerUserIdInOrderByUpdatedAtDesc(UUID tenantId,List<UUID> ownerUserIds);
    List<LeadEntity> findAllByTenantIdAndBranchIdInOrderByUpdatedAtDesc(UUID tenantId,List<UUID> branchIds);
    Optional<LeadEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select l from LeadEntity l where l.tenantId=:tenantId and l.id=:id") Optional<LeadEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update LeadEntity l set l.convertedCustomerId=:targetId where l.tenantId=:tenantId and l.convertedCustomerId=:sourceId")
    int reassignConvertedCustomer(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,@org.springframework.data.repository.query.Param("sourceId") UUID sourceId,@org.springframework.data.repository.query.Param("targetId") UUID targetId);
}
