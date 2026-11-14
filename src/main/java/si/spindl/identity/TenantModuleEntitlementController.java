package si.spindl.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.tenant.DevelopmentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/modules")
public class TenantModuleEntitlementController {
    private final TenantModuleEntitlementService service;
    private final DevelopmentTenant tenant;

    public TenantModuleEntitlementController(TenantModuleEntitlementService service, DevelopmentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    @GetMapping
    public List<TenantModuleEntitlementService.ModuleView> list() {
        return service.list(tenant.currentTenantId());
    }

    @PatchMapping("/{code}")
    public List<TenantModuleEntitlementService.ModuleView> setEnabled(@AuthenticationPrincipal Jwt jwt,
                                                                       @PathVariable String code,
                                                                       @Valid @RequestBody ToggleModuleRequest request) {
        return service.setEnabled(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), code, request.enabled());
    }

    public record ToggleModuleRequest(@NotNull Boolean enabled) {}
}
