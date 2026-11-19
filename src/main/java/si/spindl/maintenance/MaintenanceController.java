package si.spindl.maintenance;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

    private final MaintenanceService service;
    private final DevelopmentTenant tenant;

    public MaintenanceController(MaintenanceService service, DevelopmentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // METRICS
    // ==========================================

    @GetMapping("/metrics")
    public MaintenanceDtos.MaintenanceMetricsView metrics() {
        return service.getMetrics(tenant.currentTenantId());
    }

    // ==========================================
    // ASSETS
    // ==========================================

    @GetMapping("/assets")
    public List<MaintenanceDtos.AssetView> listAssets() {
        return service.listAssets(tenant.currentTenantId());
    }

    @PostMapping("/assets")
    @ResponseStatus(HttpStatus.CREATED)
    public MaintenanceDtos.AssetView createAsset(@Valid @RequestBody MaintenanceDtos.AssetRequest request) {
        return service.createAsset(tenant.currentTenantId(), request);
    }

    @PutMapping("/assets/{id}")
    public MaintenanceDtos.AssetView updateAsset(@PathVariable UUID id, @Valid @RequestBody MaintenanceDtos.AssetRequest request) {
        return service.updateAsset(tenant.currentTenantId(), id, request);
    }

    @PatchMapping("/assets/{id}/status")
    public MaintenanceDtos.AssetView setAssetStatus(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return service.setAssetStatus(tenant.currentTenantId(), id, status);
    }

    @PatchMapping("/assets/{id}/meter")
    public MaintenanceDtos.AssetView updateMeterHours(@PathVariable UUID id, @RequestBody Map<String, BigDecimal> body) {
        BigDecimal meter = body.get("meterHours");
        return service.updateMeterHours(tenant.currentTenantId(), id, meter != null ? meter : BigDecimal.ZERO);
    }

    // ==========================================
    // SCHEDULES
    // ==========================================

    @GetMapping("/schedules")
    public List<MaintenanceDtos.ScheduleView> listSchedules() {
        return service.listSchedules(tenant.currentTenantId());
    }

    @PostMapping("/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public MaintenanceDtos.ScheduleView createSchedule(@Valid @RequestBody MaintenanceDtos.ScheduleRequest request) {
        return service.createSchedule(tenant.currentTenantId(), request);
    }

    @PatchMapping("/schedules/{id}/active")
    public MaintenanceDtos.ScheduleView setScheduleActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        Boolean active = body.getOrDefault("active", true);
        return service.setScheduleActive(tenant.currentTenantId(), id, active);
    }

    // ==========================================
    // WORK ORDERS
    // ==========================================

    @GetMapping("/work-orders")
    public List<MaintenanceDtos.WorkOrderView> listWorkOrders() {
        return service.listWorkOrders(tenant.currentTenantId());
    }

    @PostMapping("/work-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public MaintenanceDtos.WorkOrderView createWorkOrder(@Valid @RequestBody MaintenanceDtos.WorkOrderRequest request) {
        return service.createWorkOrder(tenant.currentTenantId(), request);
    }

    @PostMapping("/work-orders/{id}/start")
    public MaintenanceDtos.WorkOrderView startWorkOrder(@PathVariable UUID id) {
        return service.startWorkOrder(tenant.currentTenantId(), id);
    }

    @PatchMapping("/work-orders/{id}/assign")
    public MaintenanceDtos.WorkOrderView assignWorkOrder(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String userIdStr = body.get("assignedTechnicianUserId");
        UUID userId = userIdStr != null && !userIdStr.isBlank() ? UUID.fromString(userIdStr) : null;
        return service.assignWorkOrder(tenant.currentTenantId(), id, userId);
    }

    @PostMapping("/work-orders/{id}/complete")
    public MaintenanceDtos.WorkOrderView completeWorkOrder(@PathVariable UUID id, @Valid @RequestBody MaintenanceDtos.CompleteWorkOrderRequest request) {
        return service.completeWorkOrder(tenant.currentTenantId(), id, request);
    }

    @PostMapping("/work-orders/{id}/cancel")
    public MaintenanceDtos.WorkOrderView cancelWorkOrder(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        String notes = body != null ? body.get("notes") : null;
        return service.cancelWorkOrder(tenant.currentTenantId(), id, notes);
    }
}
