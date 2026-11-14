package si.spindl.manufacturing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface BomRepository extends JpaRepository<BomEntity,UUID>{
    List<BomEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    List<BomEntity> findAllByTenantIdAndFinishedItemIdAndStatusOrderByEffectiveFromDesc(UUID tenantId,UUID itemId,String status);
    Optional<BomEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    boolean existsByTenantIdAndFinishedItemIdAndRevision(UUID tenantId,UUID itemId,String revision);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select b from BomEntity b where b.tenantId=:tenantId and b.id=:id") Optional<BomEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @Query("select b from BomEntity b where b.tenantId=:tenantId and b.finishedItemId=:itemId and b.status='APPROVED' and b.effectiveFrom<=current_date and (b.effectiveTo is null or b.effectiveTo>=current_date) order by b.effectiveFrom desc") List<BomEntity> findEffectiveApproved(@Param("tenantId") UUID tenantId,@Param("itemId") UUID itemId);
}
