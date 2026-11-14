package si.spindl.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PosSaleTenderRepository extends JpaRepository<PosSaleTenderEntity,UUID> {
    List<PosSaleTenderEntity> findAllByTenantIdAndSaleId(UUID tenantId,UUID saleId);
}
