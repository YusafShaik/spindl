package si.spindl.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/tenant/settings/api-tokens")
public class TenantApiTokenController {
    private final TenantApiTokenService service;
    public TenantApiTokenController(TenantApiTokenService service){this.service=service;}
    @GetMapping public List<TenantApiTokenService.TokenView> list(@AuthenticationPrincipal Jwt jwt){return service.list(actor(jwt));}
    @GetMapping("/scopes") public List<String> scopes(@AuthenticationPrincipal Jwt jwt){return service.supportedScopes(actor(jwt));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public TenantApiTokenService.CreatedToken create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CreateTokenRequest request){return service.create(actor(jwt),new TenantApiTokenService.CreateTokenRequest(request.name(),request.scopes(),request.expiresInDays()));}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void revoke(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){service.revoke(actor(jwt),id);}
    private UUID actor(Jwt jwt){return UUID.fromString(jwt.getSubject());}
    public record CreateTokenRequest(@NotBlank @Size(max=120) String name,@NotEmpty List<@NotBlank String> scopes,@Min(1) @Max(365) Integer expiresInDays){}
}
