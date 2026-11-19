package si.spindl.workforce;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkforceSkillRepository extends JpaRepository<WorkforceSkillEntity, UUID> {
    List<WorkforceSkillEntity> findAllByTenantIdOrderByCategoryAscSkillCodeAsc(UUID tenantId);
    Optional<WorkforceSkillEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    Optional<WorkforceSkillEntity> findByTenantIdAndSkillCode(UUID tenantId, String skillCode);
    boolean existsByTenantIdAndSkillCode(UUID tenantId, String skillCode);
}
