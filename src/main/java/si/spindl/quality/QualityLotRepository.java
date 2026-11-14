package si.spindl.quality;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QualityLotRepository extends JpaRepository<QualityLotEntity,UUID> {
    @EntityGraph(attributePaths={"item","warehouse"}) List<QualityLotEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"item","warehouse"}) Optional<QualityLotEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<QualityLotEntity> findByTenantIdAndSourceTypeAndSourceReference(UUID tenantId,String sourceType,String sourceReference);
    @EntityGraph(attributePaths={"item","warehouse"}) @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select q from QualityLotEntity q where q.tenantId=:tenantId and q.id=:id") Optional<QualityLotEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
