package si.spindl.reports;

import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.math.BigDecimal;
import java.util.UUID;

@RestController @RequestMapping("/api/workflows/purchase-order-approval")
public class WorkflowStudioController {
    private final WorkflowStudioService service;private final CurrentTenant tenant;
    public WorkflowStudioController(WorkflowStudioService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping public WorkflowStudioService.WorkflowView get(){return service.view(tenant.currentTenantId());}
    @PostMapping("/drafts") @ResponseStatus(HttpStatus.CREATED) public WorkflowStudioService.WorkflowVersionView createDraft(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody WorkflowConfigRequest request){configure(jwt);return service.createDraft(tenant.currentTenantId(),actor(jwt),request.toConfig());}
    @PutMapping("/drafts/{id}") public WorkflowStudioService.WorkflowVersionView updateDraft(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody WorkflowConfigRequest request){configure(jwt);return service.updateDraft(tenant.currentTenantId(),actor(jwt),id,request.toConfig());}
    @PostMapping("/{id}/validate") public WorkflowStudioService.ValidationResult validate(@PathVariable UUID id){return service.validate(tenant.currentTenantId(),id);}
    @PostMapping("/{id}/preview") public WorkflowStudioService.PreviewResult preview(@PathVariable UUID id,@Valid @RequestBody PreviewRequest request){return service.preview(tenant.currentTenantId(),id,request.amount());}
    @PostMapping("/{id}/publish") public WorkflowStudioService.WorkflowVersionView publish(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){configure(jwt);return service.publish(tenant.currentTenantId(),actor(jwt),id);}
    @PostMapping("/rollback") public WorkflowStudioService.WorkflowView rollback(@AuthenticationPrincipal Jwt jwt){configure(jwt);return service.rollback(tenant.currentTenantId(),actor(jwt));}
    private UUID actor(Jwt jwt){return AuthenticatedActor.userId(jwt);}
    private void configure(Jwt jwt){JwtRoleGate.requireAny(jwt, "Only workspace administrators and managers can configure approval workflows", "OWNER", "ADMIN", "MANAGER");}
    public record WorkflowConfigRequest(@NotNull @DecimalMin("0.00") BigDecimal amountThreshold,@Min(1) @Max(3) int requiredApprovals,@NotBlank String approverRole){WorkflowStudioService.WorkflowConfig toConfig(){return new WorkflowStudioService.WorkflowConfig(amountThreshold,requiredApprovals,approverRole.trim().toUpperCase(java.util.Locale.ROOT));}}
    public record PreviewRequest(@NotNull @DecimalMin("0.00") BigDecimal amount){}
}
