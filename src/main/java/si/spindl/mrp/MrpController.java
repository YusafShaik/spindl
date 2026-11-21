package si.spindl.mrp;

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
@RequestMapping("/api/mrp")
public class MrpController {

    private final MrpService service;
    private final CurrentTenant tenant;

    public MrpController(MrpService service, CurrentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // METRICS & RUNS
    // ==========================================

    @GetMapping("/metrics")
    public MrpDtos.MrpMetricsView metrics() {
        return service.getMetrics(tenant.currentTenantId());
    }

    @GetMapping("/runs")
    public List<MrpDtos.MrpRunView> listRuns() {
        return service.listRuns(tenant.currentTenantId());
    }

    @GetMapping("/runs/{id}")
    public MrpDtos.MrpRunView getRun(@PathVariable UUID id) {
        return service.getRun(tenant.currentTenantId(), id);
    }

    @PostMapping("/calculate")
    @ResponseStatus(HttpStatus.CREATED)
    public MrpDtos.MrpRunView calculate(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) MrpDtos.CalculateMrpRequest request
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.calculateMrp(tenant.currentTenantId(), actorId, request);
    }

    // ==========================================
    // PLANNED ORDERS
    // ==========================================

    @GetMapping("/planned-orders")
    public List<MrpDtos.PlannedOrderView> listPlannedOrders(
            @RequestParam(required = false) UUID runId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String actionType
    ) {
        return service.listPlannedOrders(tenant.currentTenantId(), runId, status, actionType);
    }

    @GetMapping("/planned-orders/{id}")
    public MrpDtos.PlannedOrderView getPlannedOrder(@PathVariable UUID id) {
        return service.getPlannedOrder(tenant.currentTenantId(), id);
    }

    @PostMapping("/planned-orders/{id}/convert")
    public MrpDtos.PlannedOrderView convertOrder(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.convertPlannedOrder(tenant.currentTenantId(), actorId, id);
    }

    @PostMapping("/planned-orders/{id}/dismiss")
    public MrpDtos.PlannedOrderView dismissOrder(@PathVariable UUID id) {
        return service.dismissPlannedOrder(tenant.currentTenantId(), id);
    }

    @PostMapping({"/batch-convert", "/planned-orders/convert-batch"})
    public MrpDtos.BatchConvertResponse convertBatch(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody MrpDtos.BatchConvertRequest request
    ) {
        UUID actorId = jwt != null && jwt.getSubject() != null ? AuthenticatedActor.userId(jwt) : null;
        return service.convertBatch(tenant.currentTenantId(), actorId, request);
    }
}
