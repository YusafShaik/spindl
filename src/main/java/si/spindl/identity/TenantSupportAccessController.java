package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
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
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/settings/support-requests")
public class TenantSupportAccessController {
    private final PlatformSupportAccessService service;
    private final CurrentTenant tenant;
    public TenantSupportAccessController(PlatformSupportAccessService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}

    @GetMapping
    public List<PlatformSupportAccessDtos.SupportRequestView> list(){return service.tenantQueue(tenant.currentTenantId());}
    @PostMapping("/{id}/approve")
    public PlatformSupportAccessDtos.SupportRequestView approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody(required=false) ReviewRequest request){return service.approve(tenant.currentTenantId(),id,AuthenticatedActor.userId(jwt),request==null?null:request.note());}
    @PostMapping("/{id}/reject")
    public PlatformSupportAccessDtos.SupportRequestView reject(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ReviewRequest request){return service.reject(tenant.currentTenantId(),id,AuthenticatedActor.userId(jwt),request.note());}
    @PostMapping("/{id}/revoke")
    public PlatformSupportAccessDtos.SupportRequestView revoke(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody(required=false) ReviewRequest request){return service.revoke(tenant.currentTenantId(),id,AuthenticatedActor.userId(jwt),request==null?null:request.note());}
    public record ReviewRequest(@Size(max=500) String note){}
}
