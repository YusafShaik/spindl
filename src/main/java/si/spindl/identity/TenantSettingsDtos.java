package si.spindl.identity;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** API contract for TenantSettingsService. Mapping to entities lives in the mapper, not here. */
public final class TenantSettingsDtos {
    private TenantSettingsDtos() {}

    public record UpdateTenantSettingsRequest(
            @NotBlank @Size(min = 2, max = 180) String displayName,
            @Size(max = 180) String legalName,
            @NotBlank @Size(max = 64) String timezone,
            @NotBlank @Pattern(regexp = "[A-Za-z]{2}") String countryCode,
            @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currencyCode,
            @Min(1) @Max(12) int fiscalYearStartMonth) {}

    public record TenantSettings(UUID id, String slug, String displayName, String legalName,
                                 String timezone, String countryCode, String currencyCode,
                                 int fiscalYearStartMonth, String status, Instant gracePeriodEndsAt) {}
}
