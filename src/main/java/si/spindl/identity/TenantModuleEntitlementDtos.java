package si.spindl.identity;

import java.util.List;

/** API contract for TenantModuleEntitlementService. Mapping to entities lives in the mapper, not here. */
public final class TenantModuleEntitlementDtos {
    private TenantModuleEntitlementDtos() {}

    public record ModuleView(String code, String name, boolean required, List<String> dependencies,
                             boolean entitled, boolean enabled, String sourcePlan, int planVersion) {}
}
