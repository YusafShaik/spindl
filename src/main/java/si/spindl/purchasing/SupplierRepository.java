package si.spindl.purchasing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<SupplierEntity,UUID> {
    List<SupplierEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId);
    Page<SupplierEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId,Pageable pageable);
    Optional<SupplierEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<SupplierEntity> findByTenantIdAndIdAndActiveTrue(UUID tenantId,UUID id);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId,String code);
}
