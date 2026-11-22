package si.spindl.identity;

import java.util.List;
import java.util.UUID;

/** API contract for TenantRoleService. Mapping to entities lives in the mapper, not here. */
public final class TenantRoleDtos {
    private TenantRoleDtos() {}

    public record SaveRoleRequest(String roleCode,String displayName,String description,String cloneFrom,List<GrantRequest> permissions) {}

    public record GrantRequest(String module,String resource,String action,String scope) {}

    public record RoleView(UUID id,String roleCode,String displayName,String description,boolean systemRole,List<GrantRequest> permissions) {}
}
