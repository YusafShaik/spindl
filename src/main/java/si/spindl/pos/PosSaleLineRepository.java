package si.spindl.pos;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PosSaleLineRepository extends JpaRepository<PosSaleLineEntity,UUID> {
    List<PosSaleLineEntity> findAllByTenantIdAndSaleId(UUID tenantId,UUID saleId);
}
