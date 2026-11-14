package si.spindl.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/tenant/settings/webhooks")
public class TenantWebhookController {
    private final TenantWebhookService service;
    public TenantWebhookController(TenantWebhookService service){this.service=service;}
    @GetMapping public List<TenantWebhookService.EndpointView> list(@AuthenticationPrincipal Jwt jwt){return service.list(actor(jwt));}
    @GetMapping("/deliveries") public List<TenantWebhookService.DeliveryView> deliveries(@AuthenticationPrincipal Jwt jwt){return service.deliveryHistory(actor(jwt));}
    @GetMapping("/events") public List<String> events(@AuthenticationPrincipal Jwt jwt){return service.supportedEvents(actor(jwt));}
    @PostMapping("/deliveries/{id}/replay") public TenantWebhookService.DeliveryView replay(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.replay(actor(jwt),id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public TenantWebhookService.CreatedEndpoint create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateWebhookRequest request){return service.create(actor(jwt),new TenantWebhookService.CreateEndpointRequest(request.name(),request.targetUrl(),request.eventTypes()));}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deactivate(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){service.deactivate(actor(jwt),id);}
    private UUID actor(Jwt jwt){return UUID.fromString(jwt.getSubject());}
    public record CreateWebhookRequest(@NotBlank @Size(max=120) String name,@NotBlank @Size(max=2048) String targetUrl,@NotEmpty List<@NotBlank String> eventTypes){}
}
