package si.spindl.purchasing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
public class SupplierController {
    private final SupplierService supplierService;
    private final DevelopmentTenant tenant;

    @GetMapping
    public List<SupplierView> list() {
        return supplierService.list(tenant.currentTenantId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SupplierRequest request) {
        return supplierService.create(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), request);
    }

    @PutMapping("/{id}")
    public SupplierView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SupplierUpdate request) {
        return supplierService.update(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id, request);
    }

    public interface SupplierProfile {
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
        Integer leadTimeDays();
        BigDecimal rating();
        String notes();
    }

    public record SupplierRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @Size(max = 180) String contactName,
            @Size(max = 40) String phone,
            @Size(max = 180) String addressLine1,
            @Size(max = 180) String addressLine2,
            @Size(max = 100) String city,
            @Size(max = 100) String region,
            @Size(max = 24) String postalCode,
            @Pattern(regexp = "[A-Za-z]{2}") String countryCode,
            @Size(max = 80) String taxId,
            @Min(0) @Max(365) Integer paymentTermsDays,
            @Min(0) @Max(3650) Integer leadTimeDays,
            @DecimalMin("0.0") @DecimalMax("5.0") @Digits(integer = 1, fraction = 1) BigDecimal rating,
            @Size(max = 1000) String notes) implements SupplierProfile {}

    public record SupplierUpdate(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Email @Size(max = 254) String email,
            String status,
            Boolean active,
            @Size(max = 180) String contactName,
            @Size(max = 40) String phone,
            @Size(max = 180) String addressLine1,
            @Size(max = 180) String addressLine2,
            @Size(max = 100) String city,
            @Size(max = 100) String region,
            @Size(max = 24) String postalCode,
            @Pattern(regexp = "[A-Za-z]{2}") String countryCode,
            @Size(max = 80) String taxId,
            @Min(0) @Max(365) Integer paymentTermsDays,
            @Min(0) @Max(3650) Integer leadTimeDays,
            @DecimalMin("0.0") @DecimalMax("5.0") @Digits(integer = 1, fraction = 1) BigDecimal rating,
            @Size(max = 1000) String notes) implements SupplierProfile {}

    public record SupplierView(UUID id, String code, String name, String email, String status, String contactName,
                               String phone, String addressLine1, String addressLine2, String city, String region,
                               String postalCode, String countryCode, String taxId, int paymentTermsDays,
                               int leadTimeDays, BigDecimal rating, String notes) {
        public static SupplierView from(SupplierEntity s) {
            return new SupplierView(s.getId(), s.getCode(), s.getName(), s.getEmail(), s.getStatus(), s.getContactName(),
                    s.getPhone(), s.getAddressLine1(), s.getAddressLine2(), s.getCity(), s.getRegion(), s.getPostalCode(),
                    s.getCountryCode(), s.getTaxId(), s.getPaymentTermsDays(), s.getLeadTimeDays(), s.getRating(), s.getNotes());
        }
    }
}
