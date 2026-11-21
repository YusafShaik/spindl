package si.spindl.identity;

import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import si.spindl.config.SpindlProperties;
import si.spindl.crm.LeadRepository;
import si.spindl.inventory.InventoryCycleCountRepository;
import si.spindl.party.CustomerRepository;

/** Maps every business API request to a database-backed tenant permission. Unknown routes fail closed. */
@Component
public class TenantPermissionAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {
    private final TenantMembershipRepository memberships;
    private final TenantRolePermissionRepository permissions;
    private final TenantRepository tenants;
    private final TenantModuleEntitlementService moduleEntitlements;
    private final LeadRepository leads;
    private final InventoryCycleCountRepository cycleCounts;
    private final CustomerRepository customers;
    private final TenantMembershipBranchRepository memberBranches;
    private final String platformBillingEmails;
    private final String platformSupportEmails;
    private final AntPathMatcher paths = new AntPathMatcher();
    private final Map<String, String> moduleAndResource = Map.ofEntries(
            Map.entry("/api/dashboard/**", "dashboard:overview"),
            Map.entry("/api/customers/**", "crm:customers"),
            Map.entry("/api/leads/**", "crm:leads"),
            Map.entry("/api/suppliers/**", "purchasing:suppliers"),
            Map.entry("/api/purchase-orders/**", "purchasing:orders"),
            Map.entry("/api/purchase-requisitions/**", "purchasing:requisitions"),
            Map.entry("/api/items/**", "catalog:items"),
            Map.entry("/api/inventory/**", "inventory:stock"),
            Map.entry("/api/quotes/**", "sales:quotes"),
            Map.entry("/api/sales-orders/**", "sales:orders"),
            Map.entry("/api/pos/**", "sales:orders"),
            Map.entry("/api/invoices/**", "finance:invoices"),
            Map.entry("/api/customer-credit-notes/**", "finance:credits"),
            Map.entry("/api/supplier-bills/**", "finance:supplier-bills"),
            Map.entry("/api/supplier-credit-notes/**", "finance:credits"),
            Map.entry("/api/transactions/**", "finance:transactions"),
            Map.entry("/api/gl/**", "finance:transactions"),
            Map.entry("/api/reports/**", "finance:transactions"),
            Map.entry("/api/report-builder/**", "finance:transactions"),
            Map.entry("/api/document-templates/**", "finance:invoices"),
            Map.entry("/api/workflows/**", "finance:transactions"),
            Map.entry("/api/imports/**", "imports:data"),
            Map.entry("/api/team/**", "team:memberships"),
            Map.entry("/api/audit-events/**", "operations:audit"),
            Map.entry("/api/notifications/**", "operations:notifications"),
            Map.entry("/api/tenant/**", "tenant:settings"),
            Map.entry("/api/boms/**", "manufacturing:boms"),
            Map.entry("/api/engineering/**", "manufacturing:boms"),
            Map.entry("/api/work-orders/**", "manufacturing:work-orders"),
            Map.entry("/api/work-centers/**", "manufacturing:work-centers"),
            Map.entry("/api/maintenance/**", "manufacturing:work-orders"),
            Map.entry("/api/workforce/**", "manufacturing:work-orders"),
            Map.entry("/api/mrp/**", "manufacturing:work-orders"),
            Map.entry("/api/logistics/**", "sales:orders"),
            Map.entry("/api/quality/**", "quality:inspections"));

    public TenantPermissionAuthorizationManager(TenantMembershipRepository memberships, TenantRolePermissionRepository permissions,
                                                TenantRepository tenants, TenantModuleEntitlementService moduleEntitlements,LeadRepository leads,InventoryCycleCountRepository cycleCounts,CustomerRepository customers,TenantMembershipBranchRepository memberBranches,
                                                SpindlProperties properties) {
        this.memberships = memberships; this.permissions = permissions; this.tenants = tenants;
        this.moduleEntitlements = moduleEntitlements;this.leads=leads;this.cycleCounts=cycleCounts;this.customers=customers;this.memberBranches=memberBranches;
        this.platformBillingEmails = properties.getPlatformBillingEmails();
        this.platformSupportEmails = properties.getPlatformSupportEmails();
    }

    @Override
    public AuthorizationDecision authorize(Supplier<? extends Authentication> authenticationSupplier, RequestAuthorizationContext context) {
        Authentication authentication = authenticationSupplier.get();
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !authentication.isAuthenticated()) return new AuthorizationDecision(false);
        String path=context.getRequest().getRequestURI();
        if(path.startsWith("/api/platform/"))return authorizePlatformRoute(jwt,context.getRequest().getMethod(),path);
        try {
            UUID tenantId = UUID.fromString(jwt.getToken().getClaimAsString("tenant_id"));
            UUID userId = UUID.fromString(jwt.getToken().getSubject());
            var accessState = tenants.findAccessStateById(tenantId).orElse(null);
            if (accessState == null || "closed".equals(accessState.getStatus())) return new AuthorizationDecision(false);
            String method = context.getRequest().getMethod();
            boolean supportConsentRoute=paths.match("/api/tenant/settings/support-requests/**",path);
            boolean readOnly = "suspended".equals(accessState.getStatus())
                    || ("past_due".equals(accessState.getStatus())
                    && (accessState.getGracePeriodEndsAt() == null || java.time.Instant.now().isAfter(accessState.getGracePeriodEndsAt())));
            if (readOnly && !Set.of("GET", "HEAD", "OPTIONS").contains(method) && !(supportConsentRoute&&"POST".equals(method))) return new AuthorizationDecision(false);
            String role = memberships.findActiveRole(tenantId, userId).orElse(null);
            if (role == null) return new AuthorizationDecision(false);
            boolean branchRoute=path.equals("/api/tenant/branches")||path.startsWith("/api/tenant/branches/");
            if(branchRoute&&"GET".equals(method)&&path.equals("/api/tenant/branches"))return new AuthorizationDecision(true);
            if(supportConsentRoute&&!Set.of("OWNER","ADMIN").contains(role))return new AuthorizationDecision(false);
            if (paths.match("/api/attachments/**", path)) return authorizeAttachment(tenantId,userId,role,method,path);
            if ((paths.match("/api/team/**",path)||paths.match("/api/tenant/roles/**",path))
                    && !Set.of("OWNER","ADMIN").contains(role)) return new AuthorizationDecision(false);
            if(branchRoute&&!"GET".equals(method)&&!Set.of("OWNER","ADMIN").contains(role))return new AuthorizationDecision(false);
            if (path.startsWith("/api/tenant/settings/plan-requests")&&!Set.of("OWNER","ADMIN").contains(role)) return new AuthorizationDecision(false);
            if (paths.match("/api/custom-fields/**",path)) return authorizeCustomFields(tenantId,userId,role,method,path,context.getRequest());
            if (paths.match("/api/audit-events/**",path)) {
                if (path.endsWith("/export") && !Set.of("OWNER","ADMIN").contains(role)) return new AuthorizationDecision(false);
            }
            var area = moduleAndResource.entrySet().stream().filter(entry -> paths.match(entry.getKey(), path)).map(Map.Entry::getValue).findFirst().orElse(null);
            if (area == null) return new AuthorizationDecision(false);
            String[] parts = area.split(":");
            if (!"tenant".equals(parts[0]) && !moduleEntitlements.isEnabled(tenantId, parts[0])) return new AuthorizationDecision(false);
            String action = action(method, path);
            if(action==null)return new AuthorizationDecision(false);
            if(jwt.getToken().hasClaim("api_token_id")){
                List<String> scopes=jwt.getToken().getClaimAsStringList("api_scopes");
                if(scopes==null||!scopes.contains(parts[0]+":"+parts[1]+":"+action))return new AuthorizationDecision(false);
            }
            if(permissions.allows(tenantId,role,parts[0],parts[1],action,"ALL"))return new AuthorizationDecision(true);
            if("crm".equals(parts[0])&&"leads".equals(parts[1]))return authorizeLeadScopedRequest(tenantId,userId,role,action,path);
            if("crm".equals(parts[0])&&"customers".equals(parts[1])&&permissions.allows(tenantId,role,"crm","customers",action,"OWN"))return authorizeOwnCustomerRequest(tenantId,userId,path);
            if("inventory".equals(parts[0])&&"stock".equals(parts[1])&&path.contains("/cycle-counts"))return authorizeCycleCountScopedRequest(tenantId,userId,role,action,path);
            return new AuthorizationDecision(false);
        } catch (RuntimeException invalidOrMissingClaims) {
            return new AuthorizationDecision(false);
        }
    }

    private AuthorizationDecision authorizePlatformRoute(JwtAuthenticationToken jwt,String method,String path){
        if(path.startsWith("/api/platform/support-requests")){
            if(!emailAllowed(jwt.getToken().getClaimAsString("email"),platformSupportEmails))return new AuthorizationDecision(false);
            if("POST".equals(method)&&"/api/platform/support-requests".equals(path))return new AuthorizationDecision(true);
            if("GET".equals(method)&&"/api/platform/support-requests".equals(path))return new AuthorizationDecision(true);
            String[] supportSegments=path.split("/");
            return new AuthorizationDecision("GET".equals(method)&&supportSegments.length==6&&"diagnostics".equals(supportSegments[5]));
        }
        return authorizePlatformBilling(jwt,method,path);
    }

    private AuthorizationDecision authorizePlatformBilling(JwtAuthenticationToken jwt,String method,String path){
        if(!emailAllowed(jwt.getToken().getClaimAsString("email"),platformBillingEmails))return new AuthorizationDecision(false);
        if("GET".equals(method)&&"/api/platform/plan-requests".equals(path))return new AuthorizationDecision(true);
        String[] segments=path.split("/");
        return new AuthorizationDecision("POST".equals(method)&&segments.length==6&&"api".equals(segments[1])
                &&"platform".equals(segments[2])&&"plan-requests".equals(segments[3])
                &&("approve".equals(segments[5])||"reject".equals(segments[5])));
    }

    private boolean emailAllowed(String email,String configured){
        return email!=null&&!email.isBlank()&&configured!=null&&java.util.Arrays.stream(configured.split(","))
                .map(value->value.trim().toLowerCase(java.util.Locale.ROOT)).filter(value->!value.isBlank())
                .anyMatch(value->value.equals(email.trim().toLowerCase(java.util.Locale.ROOT)));
    }

    private AuthorizationDecision authorizeAttachment(UUID tenantId,UUID userId,String role,String method,String path){
        String[] segments=path.split("/");
        if(segments.length<5||segments.length>7)return new AuthorizationDecision(false);
        String[] access=switch(segments[3]){
            case "customers","leads"->new String[]{"crm",segments[3]};
            case "items"->new String[]{"catalog","items"};
            case "suppliers","purchase_orders"->new String[]{"purchasing",segments[3].equals("suppliers")?"suppliers":"orders"};
            case "quotes","sales_orders"->new String[]{"sales",segments[3].equals("quotes")?"quotes":"orders"};
            case "invoices"->new String[]{"finance","invoices"};
            case "work_orders"->new String[]{"manufacturing","work-orders"};
            default->null;
        };
        if(access==null||!moduleEntitlements.isEnabled(tenantId,access[0]))return new AuthorizationDecision(false);
        String action="GET".equals(method)?"view":"POST".equals(method)?"edit":"DELETE".equals(method)?"delete":null;
        if(action==null)return new AuthorizationDecision(false);
        if(permissions.allows(tenantId,role,access[0],access[1],action,"ALL"))return new AuthorizationDecision(true);
        if("customers".equals(segments[3])&&permissions.allows(tenantId,role,"crm","customers",action,"OWN")){
            if(segments.length==5||segments.length==6||segments.length==7)return authorizeOwnCustomerRequest(tenantId,userId,"/api/customers/"+segments[4]);
        }
        if("leads".equals(segments[3]))return authorizeLeadScopedRequest(tenantId,userId,role,action,"/api/leads/"+segments[4]);
        return new AuthorizationDecision(false);
    }

    private AuthorizationDecision authorizeCustomFields(UUID tenantId,UUID userId,String role,String method,String path,jakarta.servlet.http.HttpServletRequest request){
        if("POST".equals(method)&&("/api/custom-fields".equals(path)||path.endsWith("/publish")))
            return new AuthorizationDecision(Set.of("OWNER","ADMIN").contains(role));
        String resource=null;
        if("/api/custom-fields".equals(path))resource=request.getParameter("resource");
        else {
            String[] segments=path.split("/");
            if(segments.length>=5)resource=segments[3];
        }
        String[] mapping=switch(resource==null?"":resource.toLowerCase(java.util.Locale.ROOT)){
            case "customers"->new String[]{"crm","customers"};
            case "items"->new String[]{"catalog","items"};
            case "suppliers"->new String[]{"purchasing","suppliers"};
            case "purchase_orders"->new String[]{"purchasing","orders"};
            case "sales_orders","quotes"->new String[]{"sales",resource.equalsIgnoreCase("quotes")?"quotes":"orders"};
            case "invoices"->new String[]{"finance","invoices"};
            case "work_orders"->new String[]{"manufacturing","work-orders"};
            default->null;
        };
        boolean importRoute=path.endsWith("/import/preview")||path.endsWith("/import/commit");
        if(mapping==null||!(Set.of("GET","PUT").contains(method)||("POST".equals(method)&&importRoute)))return new AuthorizationDecision(false);
        if(!moduleEntitlements.isEnabled(tenantId,mapping[0]))return new AuthorizationDecision(false);
        String action="GET".equals(method)?"view":"POST".equals(method)?"import":"edit";
        if("GET".equals(method)&&"/api/custom-fields".equals(path))action="view";
        if(permissions.allows(tenantId,role,mapping[0],mapping[1],action,"ALL"))return new AuthorizationDecision(true);
        if("customers".equalsIgnoreCase(resource)&&permissions.allows(tenantId,role,"crm","customers",action,"OWN")){
            if("GET".equals(method)&&"/api/custom-fields".equals(path))return new AuthorizationDecision(true);
            String[] segments=path.split("/");
            if(segments.length==5)return authorizeOwnCustomerRequest(tenantId,userId,"/api/customers/"+segments[4]);
        }
        if("leads".equalsIgnoreCase(resource)){
            if("GET".equals(method)&&"/api/custom-fields".equals(path))return new AuthorizationDecision(List.of("OWN","TEAM","BRANCH").stream().anyMatch(scope->permissions.allows(tenantId,role,"crm","leads","view",scope)));
            String[] segments=path.split("/");if(segments.length==5)return authorizeLeadScopedRequest(tenantId,userId,role,action,"/api/leads/"+segments[4]);
        }
        return new AuthorizationDecision(false);
    }

    private AuthorizationDecision authorizeLeadScopedRequest(UUID tenantId,UUID userId,String role,String action,String path){
        String[] segments=path.split("/");
        if(segments.length<=3)return new AuthorizationDecision(List.of("OWN","TEAM","BRANCH").stream().anyMatch(scope->permissions.allows(tenantId,role,"crm","leads",action,scope)));
        String leadId=segments[3];
        var lead=leads.findByTenantIdAndId(tenantId,UUID.fromString(leadId)).orElse(null);if(lead==null)return new AuthorizationDecision(false);
        boolean allowed=permissions.allows(tenantId,role,"crm","leads",action,"OWN")&&userId.equals(lead.getOwnerUserId());
        allowed|=permissions.allows(tenantId,role,"crm","leads",action,"TEAM")&&(userId.equals(lead.getOwnerUserId())||memberships.findAllByTenantIdAndManagerUserIdAndActiveTrueOrderByCreatedAtAsc(tenantId,userId).stream().anyMatch(member->member.getUserId().equals(lead.getOwnerUserId())));
        allowed|=permissions.allows(tenantId,role,"crm","leads",action,"BRANCH")&&memberBranches.existsByTenantIdAndUserIdAndBranchId(tenantId,userId,lead.getBranchId());
        return new AuthorizationDecision(allowed);
    }

    private AuthorizationDecision authorizeOwnLead(UUID tenantId,UUID userId,String leadId){
        try{return new AuthorizationDecision(leads.findByTenantIdAndId(tenantId,UUID.fromString(leadId)).map(lead->userId.equals(lead.getOwnerUserId())).orElse(false));}
        catch(IllegalArgumentException invalidId){return new AuthorizationDecision(false);}
    }

    private AuthorizationDecision authorizeOwnCustomerRequest(UUID tenantId,UUID userId,String path){
        String[] segments=path.split("/");
        if(segments.length<=3)return new AuthorizationDecision(true); // Collection reads are filtered by creator in CustomerController.
        try{return new AuthorizationDecision(customers.findByTenantIdAndId(tenantId,UUID.fromString(segments[3])).map(customer->userId.equals(customer.getCreatedBy())).orElse(false));}
        catch(IllegalArgumentException invalidId){return new AuthorizationDecision(false);}
    }


    private AuthorizationDecision authorizeCycleCountScopedRequest(UUID tenantId,UUID userId,String role,String action,String path){
        boolean all=permissions.allows(tenantId,role,"inventory","cycle-counts",action,"ALL"),own=permissions.allows(tenantId,role,"inventory","cycle-counts",action,"OWN"),team=permissions.allows(tenantId,role,"inventory","cycle-counts",action,"TEAM"),branch=permissions.allows(tenantId,role,"inventory","cycle-counts",action,"BRANCH");
        String[] segments=path.split("/");if(segments.length<=4)return new AuthorizationDecision(all||own||team||branch);
        try{var count=cycleCounts.findByTenantIdAndId(tenantId,UUID.fromString(segments[4])).orElse(null);if(count==null)return new AuthorizationDecision(false);if(all)return new AuthorizationDecision(true);boolean allowed=own&&userId.equals(count.getCreatedBy());allowed|=team&&(userId.equals(count.getCreatedBy())||memberships.findAllByTenantIdAndManagerUserIdAndActiveTrueOrderByCreatedAtAsc(tenantId,userId).stream().anyMatch(member->member.getUserId().equals(count.getCreatedBy())));allowed|=branch&&memberBranches.hasActiveAssignment(tenantId,userId,count.getWarehouse().getBranchId());return new AuthorizationDecision(allowed);}catch(IllegalArgumentException invalidId){return new AuthorizationDecision(false);}
    }

    private AuthorizationDecision authorizeOwnCycleCountRequest(UUID tenantId,UUID userId,String path){
        String[] segments=path.split("/");
        if(segments.length<=4)return new AuthorizationDecision(true); // Collection reads are filtered by creator; creates use the authenticated actor.
        try{return new AuthorizationDecision(cycleCounts.findByTenantIdAndId(tenantId,UUID.fromString(segments[4])).map(count->userId.equals(count.getCreatedBy())).orElse(false));}
        catch(IllegalArgumentException invalidId){return new AuthorizationDecision(false);}
    }

    private String action(String method, String path) {
        if ("GET".equals(method)) return (paths.match("/api/reports/**",path)||paths.match("/api/audit-events/**",path)||paths.match("/api/imports/**",path))&&path.endsWith("/export") ? "export" : "view";
        if ("PUT".equals(method) || "PATCH".equals(method)) return "edit";
        if ("DELETE".equals(method)) return "delete";
        if (!"POST".equals(method)) return null;
        List<Map.Entry<String, String>> special = List.of(
                Map.entry("/approve", "approve"), Map.entry("/accept", "approve"), Map.entry("/reject", "approve"), Map.entry("/submit", "edit"),
                Map.entry("/receive", "receive"), Map.entry("/return", "return"), Map.entry("/dispatch", "fulfill"), Map.entry("/pod", "fulfill"),
                Map.entry("/payments", "pay"), Map.entry("/refunds", "pay"), Map.entry("/credits", "credit"), Map.entry("/adjustments", "adjust"),
                Map.entry("/low-stock-threshold", "edit"), Map.entry("/send", "edit"), Map.entry("/convert", "create"),
                Map.entry("/commit", "import"), Map.entry("/preview", "view"),
                Map.entry("/release", "release"), Map.entry("/issue", "issue"), Map.entry("/output", "receive"),
                Map.entry("/pause", "edit"), Map.entry("/resume", "edit"), Map.entry("/cancel", "edit"), Map.entry("/close", "approve"),
                Map.entry("/start", "start"), Map.entry("/complete", "complete"), Map.entry("/assign", "assign"));
        for (var entry : special) if (path.endsWith(entry.getKey())) return entry.getValue();
        return "create";
    }
}
