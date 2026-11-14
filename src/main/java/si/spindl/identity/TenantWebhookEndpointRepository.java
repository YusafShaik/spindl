package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantWebhookEndpointRepository extends JpaRepository<TenantWebhookEndpointEntity,UUID> {
    List<TenantWebhookEndpointEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @Query(value="SELECT * FROM tenant_webhook_endpoints WHERE tenant_id=:tenantId AND active=true AND event_types @> jsonb_build_array(CAST(:eventType AS text))",nativeQuery=true)
    List<TenantWebhookEndpointEntity> findActiveForEvent(@Param("tenantId") UUID tenantId,@Param("eventType") String eventType);
    Optional<TenantWebhookEndpointEntity> findByTenantIdAndId(UUID tenantId,UUID id);
}
