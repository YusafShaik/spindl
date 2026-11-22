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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/platform/plan-requests")
public class PlatformPlanReviewController {
    private final TenantPlanChangeRequestService service;
    public PlatformPlanReviewController(TenantPlanChangeRequestService service){this.service=service;}

    @GetMapping
    public List<TenantPlanChangeRequestDtos.PlatformRequestView> queue(){return service.platformQueue();}

    @PostMapping("/{id}/approve")
    public TenantPlanChangeRequestDtos.PlatformRequestView approve(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody(required=false) ReviewRequest request){
        return service.approve(id,AuthenticatedActor.userId(jwt),jwt.getClaimAsString("email"),request==null?null:request.note());
    }

    @PostMapping("/{id}/reject")
    public TenantPlanChangeRequestDtos.PlatformRequestView reject(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ReviewRequest request){
        return service.reject(id,AuthenticatedActor.userId(jwt),jwt.getClaimAsString("email"),request.note());
    }

    public record ReviewRequest(@Size(max=500) String note){}
}
