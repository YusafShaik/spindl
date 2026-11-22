package si.spindl.identity;

import java.util.UUID;

/** API contract for TenantBranchService. Mapping to entities lives in the mapper, not here. */
public final class TenantBranchDtos {
    private TenantBranchDtos() {}

    public record SaveBranchRequest(String code, String name, String legalName, String taxRegistration) {}

    public record BranchView(UUID id, String code, String name, String legalName, String taxRegistration, boolean active, boolean defaultBranch) {}
}
