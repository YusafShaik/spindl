package si.spindl.identity;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/roles")
public class TenantRoleController {
    private final TenantRoleService roles;
    private final DevelopmentTenant tenant;
    public TenantRoleController(TenantRoleService roles,DevelopmentTenant tenant){this.roles=roles;this.tenant=tenant;}

    @GetMapping public List<TenantRoleService.RoleView> list(){return roles.list(tenant.currentTenantId());}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public TenantRoleService.RoleView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody TenantRoleService.SaveRoleRequest request){
        return roles.create(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),request);
    }
    @PutMapping("/{code}")
    public TenantRoleService.RoleView update(@AuthenticationPrincipal Jwt jwt,@PathVariable String code,@Valid @RequestBody TenantRoleService.SaveRoleRequest request){
        return roles.update(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),code,request);
    }
    @DeleteMapping("/{code}")
    public java.util.Map<String,String> delete(@AuthenticationPrincipal Jwt jwt,@PathVariable String code){
        roles.delete(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),code);
        return java.util.Map.of("status","deleted");
    }
}
