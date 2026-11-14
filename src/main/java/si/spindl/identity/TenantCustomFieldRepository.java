package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantCustomFieldRepository extends JpaRepository<TenantCustomFieldEntity,UUID> {
    List<TenantCustomFieldEntity> findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(UUID tenantId,String resourceCode);
    Optional<TenantCustomFieldEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    Optional<TenantCustomFieldEntity> findByTenantIdAndResourceCodeAndFieldKey(UUID tenantId,String resourceCode,String fieldKey);
}
