package si.spindl.identity;

import si.spindl.identity.TenantSettingsDtos.TenantSettings;

/** Entity and row mapping for TenantSettingsDtos. The records themselves stay free of persistence types. */
public final class TenantSettingsMapper {
    private TenantSettingsMapper() {}

    public static TenantSettings toTenantSettings(TenantEntity tenant) {

            return new TenantSettings(tenant.getId(), tenant.getSlug(), tenant.getDisplayName(), tenant.getLegalName(),
                    tenant.getTimezone(), tenant.getCountryCode(), tenant.getCurrencyCode(),
                    tenant.getFiscalYearStartMonth(), tenant.getStatus(), tenant.getGracePeriodEndsAt());
        
    }
}
