package si.spindl.party;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {
    private final CustomerService customerService;
    private final CustomerMergeService merges;
    private final DevelopmentTenant tenant;

    @GetMapping
    public List<CustomerView> list(@AuthenticationPrincipal Jwt jwt,
                                   @RequestParam(required = false) String email,
                                   @RequestParam(required = false) String phone) {
        return customerService.list(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), email, phone);
    }

    @GetMapping("/{id}/timeline")
    public List<CustomerTimelineView> timeline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return customerService.timeline(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id);
    }

    @PostMapping("/{sourceId}/merge")
    public CustomerMergeService.MergeResult merge(@AuthenticationPrincipal Jwt jwt,
                                                  @PathVariable UUID sourceId,
                                                  @Valid @RequestBody MergeCustomersRequest request) {
        return merges.merge(UUID.fromString(jwt.getSubject()), sourceId, request.targetCustomerId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CustomerRequest request) {
        return customerService.create(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), request);
    }

    @PutMapping("/{id}")
    public CustomerView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CustomerUpdate request) {
        return customerService.update(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id, request);
    }

    public record MergeCustomersRequest(@jakarta.validation.constraints.NotNull UUID targetCustomerId) {}

    public record CustomerTimelineView(String occurredAt, String eventType, String reference, String status, BigDecimal amount) {}

    public interface CustomerProfile {
        String customerType();
        String contactName();
        String phone();
        String addressLine1();
        String addressLine2();
        String city();
        String region();
        String postalCode();
        String countryCode();
        String taxId();
        Integer paymentTermsDays();
        BigDecimal creditLimit();
        String tags();
        Boolean creditHold();
    }

    public record CustomerRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Email @Size(max = 254) String email,
            String status,
            @jakarta.validation.constraints.Pattern(regexp = "(?i)(COMPANY|INDIVIDUAL)") String customerType,
            @Size(max = 180) String contactName,
            @Size(max = 40) String phone,
            @Size(max = 180) String addressLine1,
            @Size(max = 180) String addressLine2,
            @Size(max = 100) String city,
            @Size(max = 100) String region,
            @Size(max = 24) String postalCode,
            @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z]{2}") String countryCode,
            @Size(max = 80) String taxId,
            @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(365) Integer paymentTermsDays,
            @jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer = 12, fraction = 2) BigDecimal creditLimit,
            @Size(max = 1000) String tags,
            Boolean creditHold) implements CustomerProfile {}

    public record CustomerUpdate(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank String status,
            boolean active,
            @jakarta.validation.constraints.Pattern(regexp = "(?i)(COMPANY|INDIVIDUAL)") String customerType,
            @Size(max = 180) String contactName,
            @Size(max = 40) String phone,
            @Size(max = 180) String addressLine1,
            @Size(max = 180) String addressLine2,
            @Size(max = 100) String city,
            @Size(max = 100) String region,
            @Size(max = 24) String postalCode,
            @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z]{2}") String countryCode,
            @Size(max = 80) String taxId,
            @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(365) Integer paymentTermsDays,
            @jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer = 12, fraction = 2) BigDecimal creditLimit,
            @Size(max = 1000) String tags,
            Boolean creditHold) implements CustomerProfile {}

    public record CustomerView(UUID id, String code, String name, String email, long orders, String outstanding,
                               String status, String initials, String tone, String customerType, String contactName,
                               String phone, String addressLine1, String addressLine2, String city, String region,
                               String postalCode, String countryCode, String taxId, int paymentTermsDays,
                               BigDecimal creditLimit, String tags, UUID ownerUserId, boolean creditHold) {
        public static CustomerView from(CustomerEntity c, long orderCount, BigDecimal balance) {
            String cleaned = c.getName().replaceAll("[^A-Za-z0-9 ]", "").trim();
            String[] words = cleaned.isEmpty() ? new String[]{"?"} : cleaned.split("\\s+");
            String mark = words.length > 1 ? ("" + words[0].charAt(0) + words[1].charAt(0)).toUpperCase() : words[0].substring(0, Math.min(2, words[0].length())).toUpperCase();
            String amount = "₹ " + balance.stripTrailingZeros().toPlainString();
            return new CustomerView(c.getId(), c.getCode(), c.getName(), c.getEmail(), orderCount, amount, c.getStatus(), mark, "lavender", c.getCustomerType(), c.getContactName(), c.getPhone(), c.getAddressLine1(), c.getAddressLine2(), c.getCity(), c.getRegion(), c.getPostalCode(), c.getCountryCode(), c.getTaxId(), c.getPaymentTermsDays(), c.getCreditLimit(), c.getTags(), c.getOwnerUserId(), c.isCreditHold());
        }
    }
}
