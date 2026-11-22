package si.spindl.identity;

import si.spindl.identity.TenantBranchDtos.BranchView;

/** Entity and row mapping for TenantBranchDtos. The records themselves stay free of persistence types. */
public final class TenantBranchMapper {
    private TenantBranchMapper() {}

    public static BranchView toBranchView(TenantBranchEntity b) {

            return new BranchView(b.getId(), b.getCode(), b.getName(), b.getLegalName(), b.getTaxRegistration(), b.isActive(), b.isDefaultBranch());
        
    }
}
