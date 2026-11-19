package si.spindl.engineering;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EcoBomDiffLineRepository extends JpaRepository<EcoBomDiffLineEntity, UUID> {

    @EntityGraph(attributePaths = {"componentItem"})
    List<EcoBomDiffLineEntity> findAllByTenantIdAndEcoIdOrderById(UUID tenantId, UUID ecoId);
}
