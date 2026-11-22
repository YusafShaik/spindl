package si.spindl.party;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.common.security.AuthenticatedActor;
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {
    private final CustomerService customerService;
    private final CustomerMergeService merges;
    private final CurrentTenant tenant;

    @GetMapping
    public List<CustomerDtos.CustomerView> list(@AuthenticationPrincipal Jwt jwt,
                                                 @RequestParam(required = false) String email,
                                                 @RequestParam(required = false) String phone) {
        return customerService.list(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), email, phone);
    }

    @GetMapping("/{id}/timeline")
    public List<CustomerDtos.CustomerTimelineView> timeline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return customerService.timeline(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id);
    }

    @PostMapping("/{sourceId}/merge")
    public CustomerMergeDtos.MergeResult merge(@AuthenticationPrincipal Jwt jwt,
                                                  @PathVariable UUID sourceId,
                                                  @Valid @RequestBody CustomerDtos.MergeCustomersRequest request) {
        return merges.merge(AuthenticatedActor.userId(jwt), sourceId, request.targetCustomerId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerDtos.CustomerView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CustomerDtos.CustomerRequest request) {
        return customerService.create(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request);
    }

    @PutMapping("/{id}")
    public CustomerDtos.CustomerView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CustomerDtos.CustomerUpdate request) {
        return customerService.update(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, request);
    }
}
