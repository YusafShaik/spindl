package si.spindl.logistics;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ChallanItemRepository extends JpaRepository<ChallanItemEntity, UUID> {
    List<ChallanItemEntity> findAllByTenantIdAndChallanId(UUID tenantId, UUID challanId);
    void deleteAllByTenantIdAndChallanId(UUID tenantId, UUID challanId);
}
