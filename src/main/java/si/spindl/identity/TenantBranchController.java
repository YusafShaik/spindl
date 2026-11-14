package si.spindl.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/branches")
public class TenantBranchController {
    private final TenantBranchService service;private final DevelopmentTenant tenant;private final TenantMembershipRepository memberships;
    public TenantBranchController(TenantBranchService service,DevelopmentTenant tenant,TenantMembershipRepository memberships){this.service=service;this.tenant=tenant;this.memberships=memberships;}
    @GetMapping public List<TenantBranchService.BranchView> list(@AuthenticationPrincipal Jwt jwt){UUID tenantId=tenant.currentTenantId();UUID actor=UUID.fromString(jwt.getSubject());String role=memberships.findActiveRole(tenantId,actor).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN));return service.list(tenantId,actor,role);}
    @PostMapping public TenantBranchService.BranchView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BranchRequest request){return service.create(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),request.dto());}
    @PutMapping("/{id}") public TenantBranchService.BranchView update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody BranchRequest request){return service.update(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,request.dto());}
    @PatchMapping("/{id}/active") public TenantBranchService.BranchView active(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestBody Map<String,Boolean> request){Boolean active=request.get("active");if(active==null)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"The active field is required");return service.setActive(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,active);}
    public record BranchRequest(@NotBlank @Size(max=40) String code,@NotBlank @Size(max=120) String name,@Size(max=180) String legalName,@Size(max=80) String taxRegistration){TenantBranchService.SaveBranchRequest dto(){return new TenantBranchService.SaveBranchRequest(code,name,legalName,taxRegistration);}}
}
