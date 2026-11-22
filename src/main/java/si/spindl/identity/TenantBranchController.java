package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenant/branches")
@RequiredArgsConstructor
public class TenantBranchController {
    private final TenantBranchService service;
    private final CurrentTenant tenant;

    @GetMapping
    public List<TenantBranchDtos.BranchView> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(tenant.currentTenantId(), AuthenticatedActor.userId(jwt));
    }

    @PostMapping
    public TenantBranchDtos.BranchView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BranchRequest request) {
        return service.create(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request.dto());
    }

    @PutMapping("/{id}")
    public TenantBranchDtos.BranchView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody BranchRequest request) {
        return service.update(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, request.dto());
    }

    @PatchMapping("/{id}/active")
    public TenantBranchDtos.BranchView active(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody Map<String, Boolean> request) {
        Boolean active = request.get("active");
        if (active == null) {
            throw new BadRequestException("The active field is required");
        }
        return service.setActive(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, active);
    }

    public record BranchRequest(@NotBlank @Size(max = 40) String code, @NotBlank @Size(max = 120) String name, @Size(max = 180) String legalName, @Size(max = 80) String taxRegistration) {
        TenantBranchDtos.SaveBranchRequest dto() {
            return new TenantBranchDtos.SaveBranchRequest(code, name, legalName, taxRegistration);
        }
    }
}
