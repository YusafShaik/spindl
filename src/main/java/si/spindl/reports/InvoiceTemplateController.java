package si.spindl.reports;

import si.spindl.common.security.AuthenticatedActor;
import si.spindl.common.security.JwtRoleGate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/document-templates/invoices")
public class InvoiceTemplateController {
    private final InvoiceTemplateService service;private final CurrentTenant tenant;
    public InvoiceTemplateController(InvoiceTemplateService service,CurrentTenant tenant){this.service=service;this.tenant=tenant;}
    @GetMapping public InvoiceTemplateService.TemplateView view(){return service.view(tenant.currentTenantId());}
    @PostMapping("/drafts") @ResponseStatus(HttpStatus.CREATED) public InvoiceTemplateService.TemplateVersion create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody TemplateRequest request){configure(jwt);return service.createDraft(tenant.currentTenantId(),actor(jwt),request.toConfig());}
    @PutMapping("/drafts/{id}") public InvoiceTemplateService.TemplateVersion update(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody TemplateRequest request){configure(jwt);return service.updateDraft(tenant.currentTenantId(),actor(jwt),id,request.toConfig());}
    @PostMapping("/{id}/validate") public InvoiceTemplateService.Validation validate(@PathVariable UUID id){return service.validate(tenant.currentTenantId(),id);}
    @GetMapping("/{id}/preview") public InvoiceTemplateService.Preview preview(@PathVariable UUID id){return service.preview(tenant.currentTenantId(),id);}
    @PostMapping("/{id}/publish") public InvoiceTemplateService.TemplateVersion publish(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){configure(jwt);return service.publish(tenant.currentTenantId(),actor(jwt),id);}
    @PostMapping("/rollback") public InvoiceTemplateService.TemplateView rollback(@AuthenticationPrincipal Jwt jwt){configure(jwt);return service.rollback(tenant.currentTenantId(),actor(jwt));}
    private UUID actor(Jwt jwt){return AuthenticatedActor.userId(jwt);}
    private void configure(Jwt jwt){JwtRoleGate.requireAny(jwt, "Only workspace owners and admins can publish invoice templates", "OWNER", "ADMIN");}
    public record TemplateRequest(@NotBlank String documentType,@NotBlank @Size(max=100) String title,@NotBlank @Size(max=240) String footer,@NotBlank String locale,@NotBlank @Pattern(regexp="#[0-9A-Fa-f]{6}") String accentColor,@NotEmpty @Size(min=2,max=10) List<@NotBlank String> fields){InvoiceTemplateService.TemplateConfig toConfig(){return new InvoiceTemplateService.TemplateConfig(documentType.trim().toUpperCase(java.util.Locale.ROOT),title,footer,locale,accentColor,fields);}}
}
