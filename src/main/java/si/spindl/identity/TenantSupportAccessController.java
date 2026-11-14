package si.spindl.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.tenant.DevelopmentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/settings/support-requests")
public class TenantSupportAccessController {
    private final PlatformSupportAccessService service;
    private final DevelopmentTenant tenant;
    public TenantSupportAccessController(PlatformSupportAccessService service,DevelopmentTenant tenant){this.service=service;this.tenant=tenant;}

    @GetMapping
    public List<PlatformSupportAccessService.SupportRequestView> list(){return service.tenantQueue(tenant.currentTenantId());}
    @PostMapping("/{id}/approve")
    public PlatformSupportAccessService.SupportRequestView approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody(required=false) ReviewRequest request){return service.approve(tenant.currentTenantId(),id,UUID.fromString(jwt.getSubject()),request==null?null:request.note());}
    @PostMapping("/{id}/reject")
    public PlatformSupportAccessService.SupportRequestView reject(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ReviewRequest request){return service.reject(tenant.currentTenantId(),id,UUID.fromString(jwt.getSubject()),request.note());}
    @PostMapping("/{id}/revoke")
    public PlatformSupportAccessService.SupportRequestView revoke(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody(required=false) ReviewRequest request){return service.revoke(tenant.currentTenantId(),id,UUID.fromString(jwt.getSubject()),request==null?null:request.note());}
    public record ReviewRequest(@Size(max=500) String note){}
}
