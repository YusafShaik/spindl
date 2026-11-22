package si.spindl.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** API contract for TenantWebhookService. Mapping to entities lives in the mapper, not here. */
public final class TenantWebhookDtos {
    private TenantWebhookDtos() {}

    public record CreateEndpointRequest(String name, String targetUrl, List<String> eventTypes) {}

    public record EndpointView(
            UUID id,
            String name,
            String targetUrl,
            List<String> eventTypes,
            boolean active,
            Instant createdAt,
            long deadLetterCount
    ) {}

    public record DeliveryView(
            UUID id,
            String endpointName,
            String eventType,
            String status,
            int attempts,
            Instant nextAttemptAt,
            Integer responseStatus,
            String lastError,
            Instant createdAt,
            Instant deliveredAt
    ) {}

    public record CreatedEndpoint(EndpointView endpoint, String signingSecret) {}
}
