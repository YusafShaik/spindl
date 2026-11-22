package si.spindl.common.presentation;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import si.spindl.config.SpindlProperties;
import si.spindl.identity.TenantRepository;

import java.util.Locale;
import java.util.UUID;

/** Resolves the currency code used when a directory amount is rendered. */
@Component
@RequiredArgsConstructor
public class TenantCurrency {
    private final TenantRepository tenants;
    private final SpindlProperties properties;

    public String code(UUID tenantId) {
        return tenants.findById(tenantId)
                .map(tenant -> tenant.getCurrencyCode())
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .map(code -> code.toUpperCase(Locale.ROOT))
                .orElseGet(this::configuredDefault);
    }

    private String configuredDefault() {
        String fallback = properties.getDefaultCurrency();
        if (fallback == null || fallback.isBlank()) {
            return "INR";
        }
        return fallback.trim().toUpperCase(Locale.ROOT);
    }
}
