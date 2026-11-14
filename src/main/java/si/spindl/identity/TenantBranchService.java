package si.spindl.identity;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class TenantBranchService {
    private final TenantBranchRepository branches;
    private final TenantMembershipBranchRepository assignments;
    private final TenantAuditEventRepository audit;
    public TenantBranchService(TenantBranchRepository branches,TenantAuditEventRepository audit,TenantMembershipBranchRepository assignments){this.branches=branches;this.audit=audit;this.assignments=assignments;}
    @Transactional(readOnly=true) public List<BranchView> list(UUID tenantId,UUID actorId,String role){var rows=SetRoles.admin(role)?branches.findAllByTenantIdOrderByDefaultBranchDescNameAsc(tenantId):branches.findAllByTenantIdAndActiveTrueOrderByDefaultBranchDescNameAsc(tenantId).stream().filter(branch->assignments.hasActiveAssignment(tenantId,actorId,branch.getId())).toList();return rows.stream().map(BranchView::from).toList();}
    @Transactional public BranchView create(UUID tenantId,UUID actorId,SaveBranchRequest request){String code=normalizeCode(request.code());if(branches.existsByTenantIdAndCodeIgnoreCase(tenantId,code))throw new ResponseStatusException(HttpStatus.CONFLICT,"Branch code already exists");var branch=branches.save(new TenantBranchEntity(tenantId,code,clean(request.name(),120,"Branch name"),cleanOptional(request.legalName(),180),cleanOptional(request.taxRegistration(),80),false));audit.save(new TenantAuditEventEntity(tenantId,actorId,"TENANT_BRANCH_CREATED","branch",branch.getId(),Map.of("code",code)));return BranchView.from(branch);}
    @Transactional public BranchView update(UUID tenantId,UUID actorId,UUID id,SaveBranchRequest request){var branch=find(tenantId,id);String code=normalizeCode(request.code());if(!code.equalsIgnoreCase(branch.getCode())&&branches.existsByTenantIdAndCodeIgnoreCase(tenantId,code))throw new ResponseStatusException(HttpStatus.CONFLICT,"Branch code already exists");branch.update(code,clean(request.name(),120,"Branch name"),cleanOptional(request.legalName(),180),cleanOptional(request.taxRegistration(),80));audit.save(new TenantAuditEventEntity(tenantId,actorId,"TENANT_BRANCH_UPDATED","branch",id,Map.of("code",code)));return BranchView.from(branch);}
    @Transactional public BranchView setActive(UUID tenantId,UUID actorId,UUID id,boolean active){var branch=find(tenantId,id);if(branch.isDefaultBranch()&&!active)throw new ResponseStatusException(HttpStatus.CONFLICT,"The default branch cannot be deactivated");branch.setActive(active);audit.save(new TenantAuditEventEntity(tenantId,actorId,active?"TENANT_BRANCH_ACTIVATED":"TENANT_BRANCH_DEACTIVATED","branch",id,Map.of()));return BranchView.from(branch);}
    private TenantBranchEntity find(UUID tenantId,UUID id){return branches.findByTenantIdAndId(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Branch not found"));}
    private String normalizeCode(String value){String code=value==null?"":value.trim().toUpperCase(Locale.ROOT);if(!code.matches("[A-Z0-9][A-Z0-9_-]{1,39}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Branch code must be 2–40 letters, digits, dashes, or underscores");return code;}
    private String clean(String value,int max,String label){if(value==null||value.isBlank()||value.trim().length()>max)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,label+" is required (max "+max+" characters)");return value.trim();}
    private String cleanOptional(String value,int max){if(value==null||value.isBlank())return null;if(value.trim().length()>max)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Branch details are too long");return value.trim();}
    public record SaveBranchRequest(String code,String name,String legalName,String taxRegistration){}
    private static class SetRoles{static boolean admin(String role){return "OWNER".equals(role)||"ADMIN".equals(role);}}
    public record BranchView(UUID id,String code,String name,String legalName,String taxRegistration,boolean active,boolean defaultBranch){static BranchView from(TenantBranchEntity b){return new BranchView(b.getId(),b.getCode(),b.getName(),b.getLegalName(),b.getTaxRegistration(),b.isActive(),b.isDefaultBranch());}}
}
