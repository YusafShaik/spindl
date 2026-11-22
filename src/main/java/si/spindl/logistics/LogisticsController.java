package si.spindl.logistics;

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
@RequestMapping("/api/logistics")
public class LogisticsController {

    private final LogisticsService service;
    private final CurrentTenant tenant;

    public LogisticsController(LogisticsService service, CurrentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // METRICS
    // ==========================================

    @GetMapping("/metrics")
    public LogisticsDtos.LogisticsMetricsView metrics() {
        return service.getMetrics(tenant.currentTenantId());
    }

    // ==========================================
    // CHALLANS
    // ==========================================

    @GetMapping("/challans")
    public List<LogisticsDtos.ChallanSummaryView> listChallans(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return service.listChallans(tenant.currentTenantId(), status, search);
    }

    @GetMapping("/challans/{id}")
    public LogisticsDtos.ChallanDetailView getChallan(@PathVariable UUID id) {
        return service.getChallan(tenant.currentTenantId(), id);
    }

    @PostMapping("/challans")
    @ResponseStatus(HttpStatus.CREATED)
    public LogisticsDtos.ChallanDetailView createChallan(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LogisticsDtos.CreateChallanRequest request) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.createChallan(tenant.currentTenantId(), actorId, request);
    }

    @PatchMapping("/challans/{id}/tracking")
    public LogisticsDtos.ChallanSummaryView updateTracking(
            @PathVariable UUID id,
            @Valid @RequestBody LogisticsDtos.UpdateTrackingRequest request) {
        return service.updateTracking(tenant.currentTenantId(), id, request);
    }

    @PostMapping("/challans/{id}/dispatch")
    public LogisticsDtos.ChallanSummaryView dispatchChallan(@PathVariable UUID id) {
        return service.dispatchChallan(tenant.currentTenantId(), id);
    }

    @PostMapping("/challans/{id}/pod")
    public LogisticsDtos.ChallanSummaryView recordPod(
            @PathVariable UUID id,
            @Valid @RequestBody LogisticsDtos.RecordPodRequest request) {
        return service.recordPod(tenant.currentTenantId(), id, request);
    }

    @PostMapping("/challans/{id}/cancel")
    public LogisticsDtos.ChallanSummaryView cancelChallan(@PathVariable UUID id) {
        return service.cancelChallan(tenant.currentTenantId(), id);
    }
}
