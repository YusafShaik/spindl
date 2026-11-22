package si.spindl.identity;

import si.spindl.identity.TenantWebhookDtos.EndpointView;

/** Entity and row mapping for TenantWebhookDtos. The records themselves stay free of persistence types. */
public final class TenantWebhookMapper {
    private TenantWebhookMapper() {}

    public static EndpointView toEndpointView(TenantWebhookEndpointEntity endpoint, long dead) {

            return new EndpointView(
                    endpoint.getId(),
                    endpoint.getName(),
                    endpoint.getTargetUrl(),
                    endpoint.getEventTypes(),
                    endpoint.isActive(),
                    endpoint.getCreatedAt(),
                    dead
            );
        
    }
}
