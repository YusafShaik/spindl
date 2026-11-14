package si.spindl.tenant;

import org.springframework.stereotype.Component;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.UUID;

/** Resolves the active tenant only from the authenticated, server-issued membership claim. */
@Component
public class DevelopmentTenant {
    public static final UUID ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    public UUID currentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt) {
            String tenantId = jwt.getToken().getClaimAsString("tenant_id");
            if (tenantId != null) return UUID.fromString(tenantId);
        }
        throw new IllegalStateException("An authenticated tenant membership is required");
    }
}
