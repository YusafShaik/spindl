package si.spindl.engineering;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/engineering")
public class EngineeringController {

    private final EngineeringService service;
    private final CurrentTenant tenant;

    public EngineeringController(EngineeringService service, CurrentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // METRICS & LIST
    // ==========================================

    @GetMapping("/metrics")
    public EngineeringDtos.EngineeringMetricsView metrics() {
        return service.getMetrics(tenant.currentTenantId());
    }

    @GetMapping("/ecos")
    public List<EngineeringDtos.EcoSummaryView> listEcos(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity
    ) {
        return service.listEcos(tenant.currentTenantId(), status, severity);
    }

    @GetMapping("/ecos/{id}")
    public EngineeringDtos.EcoDetailView getEco(@PathVariable UUID id) {
        return service.getEco(tenant.currentTenantId(), id);
    }

    // ==========================================
    // CREATE ECO
    // ==========================================

    @PostMapping("/ecos")
    @ResponseStatus(HttpStatus.CREATED)
    public EngineeringDtos.EcoDetailView createEco(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody EngineeringDtos.CreateEcoRequest request
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.createEco(tenant.currentTenantId(), actorId, request);
    }

    // ==========================================
    // SIGN-OFF
    // ==========================================

    @PostMapping("/ecos/{id}/sign-off")
    public EngineeringDtos.EcoDetailView signOff(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody EngineeringDtos.SignOffRequest request
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.processSignOff(tenant.currentTenantId(), actorId, id, request);
    }

    // ==========================================
    // IMPLEMENT & CUTOVER
    // ==========================================

    @PostMapping("/ecos/{id}/implement")
    public EngineeringDtos.EcoDetailView implement(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) EngineeringDtos.ImplementEcoRequest request
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.implementEco(tenant.currentTenantId(), actorId, id, request);
    }
}
