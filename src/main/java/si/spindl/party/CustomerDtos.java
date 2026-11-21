package si.spindl.party;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Customer API contract. The service maps entities to these types. */
public final class CustomerDtos {

    private CustomerDtos() {
    }

    public record MergeCustomersRequest(@NotNull UUID targetCustomerId) {}

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
            @Pattern(regexp = "(?i)(COMPANY|INDIVIDUAL)") String customerType,
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
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal creditLimit,
            @Size(max = 1000) String tags,
            Boolean creditHold) implements CustomerProfile {}

    public record CustomerUpdate(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank String status,
            boolean active,
            @Pattern(regexp = "(?i)(COMPANY|INDIVIDUAL)") String customerType,
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
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal creditLimit,
            @Size(max = 1000) String tags,
            Boolean creditHold) implements CustomerProfile {}

    public record CustomerView(UUID id, String code, String name, String email, long orders, String outstanding,
                               String status, String initials, String tone, String customerType, String contactName,
                               String phone, String addressLine1, String addressLine2, String city, String region,
                               String postalCode, String countryCode, String taxId, int paymentTermsDays,
                               BigDecimal creditLimit, String tags, UUID ownerUserId, boolean creditHold) {}
}
