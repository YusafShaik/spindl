package si.spindl.purchasing;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.common.security.AuthenticatedActor;
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
public class SupplierController {
    private final SupplierService supplierService;
    private final CurrentTenant tenant;

    @GetMapping
    public List<SupplierDtos.SupplierView> list() {
        return supplierService.list(tenant.currentTenantId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierDtos.SupplierView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SupplierDtos.SupplierRequest request) {
        return supplierService.create(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request);
    }

    @PutMapping("/{id}")
    public SupplierDtos.SupplierView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SupplierDtos.SupplierUpdate request) {
        return supplierService.update(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, request);
    }
}
