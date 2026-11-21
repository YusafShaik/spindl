package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
@RequestMapping("/api/platform/support-requests")
public class PlatformSupportController {
    private final PlatformSupportAccessService service;
    public PlatformSupportController(PlatformSupportAccessService service){this.service=service;}

    @PostMapping
    public PlatformSupportAccessService.SupportRequestView request(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateRequest request){return service.request(request.tenantId(),AuthenticatedActor.userId(jwt),jwt.getClaimAsString("email"),request.reason(),request.durationMinutes());}

    @GetMapping
    public List<PlatformSupportAccessService.SupportRequestView> queue(@AuthenticationPrincipal Jwt jwt){return service.platformQueue(AuthenticatedActor.userId(jwt));}

    @GetMapping("/{id}/diagnostics")
    public PlatformSupportAccessService.Diagnostics diagnostics(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.diagnostics(id,AuthenticatedActor.userId(jwt),jwt.getClaimAsString("email"));}

    public record CreateRequest(@NotNull UUID tenantId,@NotBlank @Size(max=500) String reason,@Min(5) @Max(60) int durationMinutes){}
}
