package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TenantWebhookDeliveryRepository extends JpaRepository<TenantWebhookDeliveryEntity,UUID> {
    java.util.Optional<TenantWebhookDeliveryEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    long countByTenantIdAndEndpointIdAndStatus(UUID tenantId,UUID endpointId,String status);
    java.util.List<TenantWebhookDeliveryEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId,org.springframework.data.domain.Pageable pageable);
}
