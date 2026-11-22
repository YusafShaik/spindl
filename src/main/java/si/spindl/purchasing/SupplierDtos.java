package si.spindl.purchasing;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Supplier API contract. The service maps entities to these types. */
public final class SupplierDtos {

    private SupplierDtos() {
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
                               int leadTimeDays, BigDecimal rating, String notes) {}
}
