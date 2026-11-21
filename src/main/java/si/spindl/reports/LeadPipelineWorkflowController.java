package si.spindl.reports;

import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController @RequestMapping("/api/workflows/lead-pipeline")
public class LeadPipelineWorkflowController {
    private final LeadPipelineWorkflowService service;private final CurrentTenant tenant;
    public LeadPipelineWorkflowController(LeadPipelineWorkflowService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping public LeadPipelineWorkflowService.WorkflowView get(){return service.view(tenant.currentTenantId());}
    @PostMapping("/drafts") @ResponseStatus(HttpStatus.CREATED) public LeadPipelineWorkflowService.VersionView create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ConfigRequest request){configure(jwt);return service.createDraft(tenant.currentTenantId(),actor(jwt),request.toConfig());}
    @PutMapping("/drafts/{id}") public LeadPipelineWorkflowService.VersionView update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody ConfigRequest request){configure(jwt);return service.updateDraft(tenant.currentTenantId(),actor(jwt),id,request.toConfig());}
    @PostMapping("/{id}/validate") public LeadPipelineWorkflowService.ValidationResult validate(@PathVariable UUID id){return service.validate(tenant.currentTenantId(),id);}
    @PostMapping("/{id}/preview") public LeadPipelineWorkflowService.PreviewResult preview(@PathVariable UUID id,@Valid @RequestBody PreviewRequest request){return service.preview(tenant.currentTenantId(),id,request.from().toUpperCase(Locale.ROOT),request.to().toUpperCase(Locale.ROOT),request.role().toUpperCase(Locale.ROOT));}
    @PostMapping("/{id}/publish") public LeadPipelineWorkflowService.VersionView publish(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){configure(jwt);return service.publish(tenant.currentTenantId(),actor(jwt),id);}
    @PostMapping("/rollback") public LeadPipelineWorkflowService.WorkflowView rollback(@AuthenticationPrincipal Jwt jwt){configure(jwt);return service.rollback(tenant.currentTenantId(),actor(jwt));}
    private UUID actor(Jwt jwt){return AuthenticatedActor.userId(jwt);}
    private void configure(Jwt jwt){JwtRoleGate.requireAny(jwt, "Only workspace administrators and managers can configure workflows", "OWNER", "ADMIN", "MANAGER");}
    public record ConfigRequest(@NotBlank String initialState,@NotEmpty @Size(max=12) List<@NotBlank @Size(max=24) String> states,@NotEmpty @Size(max=40) List<@Valid TransitionRequest> transitions){LeadPipelineWorkflowService.PipelineConfig toConfig(){return new LeadPipelineWorkflowService.PipelineConfig(initialState.trim().toUpperCase(Locale.ROOT),states.stream().map(value->value.trim().toUpperCase(Locale.ROOT)).toList(),transitions.stream().map(value->new LeadPipelineWorkflowService.Transition(value.from().trim().toUpperCase(Locale.ROOT),value.to().trim().toUpperCase(Locale.ROOT),value.requiredRole()==null?"":value.requiredRole().trim().toUpperCase(Locale.ROOT))).toList());}}
    public record TransitionRequest(@NotBlank String from,@NotBlank String to,String requiredRole){}
    public record PreviewRequest(@NotBlank String from,@NotBlank String to,@NotBlank String role){}
}
