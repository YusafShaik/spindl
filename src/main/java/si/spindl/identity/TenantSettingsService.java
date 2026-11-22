package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.NotFoundException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.tenant.CurrentTenant;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import si.spindl.identity.TenantSettingsDtos.UpdateTenantSettingsRequest;
import si.spindl.identity.TenantSettingsDtos.TenantSettings;

@Service
public class TenantSettingsService {
    private final TenantRepository tenants;
    private final TenantAuditEventRepository audit;
    private final CurrentTenant tenant;

    public TenantSettingsService(TenantRepository tenants, TenantAuditEventRepository audit, CurrentTenant tenant) {
        this.tenants = tenants;
        this.audit = audit;
        this.tenant = tenant;
    }

    @Transactional(readOnly = true)
    public TenantSettings settings() { return TenantSettingsMapper.toTenantSettings(findTenant()); }

    @Transactional
    public TenantSettings update(UUID actorId, UpdateTenantSettingsRequest request) {
        var organization = findTenant();
        String timezone = request.timezone().trim();
        try { ZoneId.of(timezone); }
        catch (DateTimeException exception) { throw new BadRequestException("Choose a valid timezone"); }
        String country = request.countryCode().trim().toUpperCase(Locale.ROOT);
        if (!java.util.Arrays.asList(Locale.getISOCountries()).contains(country))
            throw new BadRequestException("Choose a valid two-letter country code");
        String currency = request.currencyCode().trim().toUpperCase(Locale.ROOT);
        try { java.util.Currency.getInstance(currency); }
        catch (IllegalArgumentException exception) { throw new BadRequestException("Choose a valid ISO currency code"); }
        String displayName = request.displayName().trim();
        String legalName = request.legalName() == null || request.legalName().isBlank() ? null : request.legalName().trim();
        organization.updateProfile(displayName, legalName, timezone, country, currency, request.fiscalYearStartMonth());
        Map<String, Object> details = new HashMap<>();
        details.put("displayName", displayName); details.put("legalName", legalName == null ? "not set" : legalName);
        details.put("timezone", timezone); details.put("countryCode", country); details.put("currencyCode", currency);
        details.put("fiscalYearStartMonth", request.fiscalYearStartMonth());
        audit.save(new TenantAuditEventEntity(organization.getId(), actorId, "TENANT_PROFILE_UPDATED", "tenant", organization.getId(), details));
        return TenantSettingsMapper.toTenantSettings(organization);
    }

    private TenantEntity findTenant() {
        return tenants.findById(tenant.currentTenantId())
                .orElseThrow(() -> new NotFoundException("Workspace not found"));
    }


}
