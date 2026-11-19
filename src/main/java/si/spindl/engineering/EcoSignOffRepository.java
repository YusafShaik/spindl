package si.spindl.engineering;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EcoSignOffRepository extends JpaRepository<EcoSignOffEntity, UUID> {

    @EntityGraph(attributePaths = {"approverUser"})
    List<EcoSignOffEntity> findAllByTenantIdAndEcoIdOrderByCreatedAtAsc(UUID tenantId, UUID ecoId);

    Optional<EcoSignOffEntity> findByTenantIdAndEcoIdAndDepartment(UUID tenantId, UUID ecoId, String department);
}
