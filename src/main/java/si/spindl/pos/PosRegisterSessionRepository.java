package si.spindl.pos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosRegisterSessionRepository extends JpaRepository<PosRegisterSessionEntity,UUID> {
    @EntityGraph(attributePaths={"register","register.warehouse"})
    List<PosRegisterSessionEntity> findAllByTenantIdOrderByOpenedAtDesc(UUID tenantId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"register","register.warehouse"})
    @Query("select s from PosRegisterSessionEntity s where s.tenantId=:tenantId and s.id=:id")
    Optional<PosRegisterSessionEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @EntityGraph(attributePaths={"register","register.warehouse"})
    Optional<PosRegisterSessionEntity> findByTenantIdAndId(UUID tenantId,UUID id);
}
