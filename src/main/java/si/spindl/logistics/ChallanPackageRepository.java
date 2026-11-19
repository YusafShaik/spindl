package si.spindl.logistics;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ChallanPackageRepository extends JpaRepository<ChallanPackageEntity, UUID> {
    List<ChallanPackageEntity> findAllByTenantIdAndChallanIdOrderByPackageNumberAsc(UUID tenantId, UUID challanId);
    void deleteAllByTenantIdAndChallanId(UUID tenantId, UUID challanId);
}
