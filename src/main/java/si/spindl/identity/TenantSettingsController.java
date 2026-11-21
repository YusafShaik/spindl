package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import si.spindl.tenant.CurrentTenant;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import java.util.List;

@RestController
@RequestMapping("/api/tenant/settings")
public class TenantSettingsController {
    private final TenantSettingsService service;
    private final SubscriptionQuotaService subscriptionQuotas;
    private final CurrentTenant tenant;
    private final TenantPlanChangeRequestService planRequests;

    public TenantSettingsController(TenantSettingsService service, SubscriptionQuotaService subscriptionQuotas, CurrentTenant tenant,TenantPlanChangeRequestService planRequests) {
        this.service = service; this.subscriptionQuotas=subscriptionQuotas; this.tenant=tenant;this.planRequests=planRequests;
    }

    @GetMapping
    public TenantSettingsService.TenantSettings settings() { return service.settings(); }

    @PutMapping
    public TenantSettingsService.TenantSettings update(@AuthenticationPrincipal Jwt jwt,
                                                       @Valid @RequestBody TenantSettingsService.UpdateTenantSettingsRequest request) {
        return service.update(AuthenticatedActor.userId(jwt), request);
    }

    @GetMapping("/plan")
    public SubscriptionQuotaService.PlanSummary plan() { return subscriptionQuotas.current(tenant.currentTenantId()); }

    @PostMapping("/plan-preview")
    public SubscriptionQuotaService.PlanChangePreview previewPlan(@jakarta.validation.Valid @RequestBody PlanPreviewRequest request) {
        return subscriptionQuotas.preview(tenant.currentTenantId(),request.planCode());
    }
    @GetMapping("/plan-requests")
    public List<TenantPlanChangeRequestService.RequestView> planRequests(){return planRequests.list(tenant.currentTenantId());}
    @PostMapping("/plan-requests")
    public TenantPlanChangeRequestService.RequestView requestPlan(@AuthenticationPrincipal Jwt jwt,@jakarta.validation.Valid @RequestBody TenantPlanChangeRequestService.CreateRequest request){return planRequests.create(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),request.planCode());}
    @DeleteMapping("/plan-requests/{id}")
    public TenantPlanChangeRequestService.RequestView cancelPlanRequest(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return planRequests.cancel(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id);}
    public record PlanPreviewRequest(@jakarta.validation.constraints.NotBlank String planCode) {}
}
