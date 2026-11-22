package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import si.spindl.identity.TenantRoleDtos.SaveRoleRequest;
import si.spindl.identity.TenantRoleDtos.GrantRequest;
import si.spindl.identity.TenantRoleDtos.RoleView;

@Service
public class TenantRoleService {
    private static final Map<String,String> BUILT_INS=Map.of("OWNER","Owner","ADMIN","Admin","MANAGER","Manager","OPERATOR","Operator","VIEWER","Viewer");
    private static final Set<String> MODULES=Set.of("dashboard","crm","catalog","inventory","sales","purchasing","manufacturing","quality","finance","imports","team","operations","tenant","*");
    private static final Set<String> ACTIONS=Set.of("view","create","edit","archive","approve","export","import","delete","assign","adjust","pay","credit","receive","return","fulfill","release","issue","start","complete","*");
    private static final Set<String> SCOPE=Set.of("ALL","OWN","TEAM","BRANCH");
    private final TenantRoleRepository roles;
    private final TenantRolePermissionRepository permissions;
    private final TenantMembershipRepository memberships;
    private final TenantInvitationRepository invitations;
    private final TenantAuditEventRepository audit;

    public TenantRoleService(TenantRoleRepository roles,TenantRolePermissionRepository permissions,
                             TenantMembershipRepository memberships,TenantInvitationRepository invitations,TenantAuditEventRepository audit){
        this.roles=roles;this.permissions=permissions;this.memberships=memberships;this.invitations=invitations;this.audit=audit;
    }

    @Transactional
    public void initialize(UUID tenantId){
        var missing=BUILT_INS.entrySet().stream().filter(entry->!roles.existsByTenantIdAndRoleCode(tenantId,entry.getKey()))
                .map(entry->new TenantRoleEntity(UUID.randomUUID(),tenantId,entry.getKey(),entry.getValue(),"Built-in workspace role",true,null)).toList();
        roles.saveAll(missing);
    }

    @Transactional(readOnly=true)
    public List<RoleView> list(UUID tenantId){
        var allGrants=permissions.findAllByTenantIdOrderByRoleAscModuleAscResourceAscActionAsc(tenantId);
        var byRole=allGrants.stream().collect(java.util.stream.Collectors.groupingBy(TenantRolePermissionEntity::getRole));
        return roles.findAllByTenantIdOrderBySystemRoleDescDisplayNameAsc(tenantId).stream()
                .map(role->view(role,byRole.getOrDefault(role.getRoleCode(),List.of()))).toList();
    }

    @Transactional
    public RoleView create(UUID tenantId,UUID actorId,SaveRoleRequest request){
        String code=normalizeCode(request.roleCode());
        if(BUILT_INS.containsKey(code))throw new ConflictException("Built-in role codes cannot be reused");
        if(roles.existsByTenantIdAndRoleCode(tenantId,code))throw new ConflictException("A role with this code already exists");
        String name=normalizeName(request.displayName());String description=normalizeDescription(request.description());
        var role=roles.save(new TenantRoleEntity(UUID.randomUUID(),tenantId,code,name,description,false,actorId));
        List<TenantRolePermissionEntity> grants;
        if(request.cloneFrom()!=null&&!request.cloneFrom().isBlank()){
            String source=normalizeExistingCode(request.cloneFrom());
            var sourceRole=roles.findByTenantIdAndRoleCode(tenantId,source).orElseThrow(()->new NotFoundException("Role to clone not found"));
            grants=permissions.findAllByTenantIdAndRoleOrderByModuleAscResourceAscActionAsc(tenantId,sourceRole.getRoleCode()).stream()
                    .map(grant->new TenantRolePermissionEntity(tenantId,code,grant.getModule(),grant.getResource(),grant.getAction(),grant.getPermissionScope())).toList();
        }else grants=List.of();
        permissions.saveAll(grants);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_ROLE_CREATED","tenant_role",role.getId(),Map.of("roleCode",code,"displayName",name,"clonedFrom",request.cloneFrom()==null?"":request.cloneFrom())));
        return view(role,grants);
    }

    @Transactional
    public RoleView update(UUID tenantId,UUID actorId,String requestedCode,SaveRoleRequest request){
        String code=normalizeExistingCode(requestedCode);
        var role=roles.findByTenantIdAndRoleCode(tenantId,code).orElseThrow(()->new NotFoundException("Role not found"));
        if(role.isSystemRole())throw new ConflictException("Built-in roles are managed by the platform; clone one to customize it");
        if(request.roleCode()!=null&&!request.roleCode().isBlank()&&!code.equals(normalizeCode(request.roleCode())))
            throw new BadRequestException("Custom role codes cannot be changed after creation");
        String name=normalizeName(request.displayName());String description=normalizeDescription(request.description());
        List<GrantRequest> requested=request.permissions()==null?List.of():request.permissions();
        var grants=requested.stream().map(grant->normalizeGrant(grant)).distinct().map(grant->
                new TenantRolePermissionEntity(tenantId,code,grant.module(),grant.resource(),grant.action(),grant.scope())).toList();
        role.update(name,description);
        permissions.deleteAllByTenantIdAndRole(tenantId,code);
        permissions.saveAll(grants);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_ROLE_UPDATED","tenant_role",role.getId(),Map.of("roleCode",code,"grantCount",grants.size())));
        return view(role,grants);
    }

    @Transactional
    public void delete(UUID tenantId,UUID actorId,String requestedCode){
        String code=normalizeExistingCode(requestedCode);
        var role=roles.findByTenantIdAndRoleCode(tenantId,code).orElseThrow(()->new NotFoundException("Role not found"));
        if(role.isSystemRole())throw new ConflictException("Built-in roles cannot be deleted");
        if(memberships.existsByTenantIdAndRole(tenantId,code))throw new ConflictException("Reassign all members, including inactive members, before deleting this role");
        invitations.deleteAllByTenantIdAndRoleAndAcceptedAtIsNull(tenantId,code);
        permissions.deleteAllByTenantIdAndRole(tenantId,code);
        roles.delete(role);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_ROLE_DELETED","tenant_role",role.getId(),Map.of("roleCode",code)));
    }

    private GrantRequest normalizeGrant(GrantRequest request){
        String module=request.module()==null?"":request.module().trim().toLowerCase(Locale.ROOT);
        String resource=request.resource()==null?"":request.resource().trim().toLowerCase(Locale.ROOT);
        String action=request.action()==null?"":request.action().trim().toLowerCase(Locale.ROOT);
        String scope=request.scope()==null?"ALL":request.scope().trim().toUpperCase(Locale.ROOT);
        boolean leadScopeSupported="crm".equals(module)&&"leads".equals(resource)&&!"*".equals(action);
        boolean cycleCountScopeSupported="inventory".equals(module)&&"cycle-counts".equals(resource)&&!"*".equals(action);
        boolean specificScopeSupported=(leadScopeSupported||cycleCountScopeSupported)&&Set.of("OWN","TEAM","BRANCH").contains(scope);
        if(!MODULES.contains(module)||!ACTIONS.contains(action)||!SCOPE.contains(scope)||!resource.matches("[a-z0-9_*.-]{1,64}")
                ||(!"ALL".equals(scope)&&!specificScopeSupported))
            throw new BadRequestException("Own, direct-team, and assigned-branch scopes are supported for CRM leads and inventory cycle counts. Other grants must use All scope.");
        return new GrantRequest(module,resource,action,scope);
    }
    private String normalizeCode(String code){
        String normalized=code==null?"":code.trim().toUpperCase(Locale.ROOT);
        if(!normalized.matches("[A-Z][A-Z0-9_]{1,23}"))throw new BadRequestException("Role code must use 2–24 letters, digits, or underscores and start with a letter");
        return normalized;
    }
    private String normalizeExistingCode(String code){String value=code==null?"":code.trim().toUpperCase(Locale.ROOT);if(!value.matches("[A-Z][A-Z0-9_]{0,23}"))throw new BadRequestException("Role code is invalid");return value;}
    private String normalizeName(String name){String value=name==null?"":name.trim();if(value.isBlank()||value.length()>80)throw new BadRequestException("Role name must be between 1 and 80 characters");return value;}
    private String normalizeDescription(String description){String value=description==null?"":description.trim();if(value.length()>240)throw new BadRequestException("Role description cannot exceed 240 characters");return value;}
    private RoleView view(TenantRoleEntity role,List<TenantRolePermissionEntity> grants){
        return new RoleView(role.getId(),role.getRoleCode(),role.getDisplayName(),role.getDescription(),role.isSystemRole(),grants.stream()
                .map(grant->new GrantRequest(grant.getModule(),grant.getResource(),grant.getAction(),grant.getPermissionScope())).toList());
    }
}
