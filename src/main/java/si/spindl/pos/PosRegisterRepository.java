package si.spindl.pos;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosRegisterRepository extends JpaRepository<PosRegisterEntity,UUID> {
    @EntityGraph(attributePaths="warehouse")
    List<PosRegisterEntity> findAllByTenantIdAndActiveTrueOrderByNameAsc(UUID tenantId);
    @EntityGraph(attributePaths="warehouse")
    Optional<PosRegisterEntity> findByTenantIdAndIdAndActiveTrue(UUID tenantId,UUID id);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId,String code);
}
