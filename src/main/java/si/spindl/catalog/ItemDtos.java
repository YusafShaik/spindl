package si.spindl.catalog;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Catalog API contract. Services map to these types and do not depend on the controller. */
public final class ItemDtos {

    private ItemDtos() {
    }

    public record ItemRequest(
            @NotBlank @Size(max = 64) String sku,
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Size(max = 100) String category,
            @Min(0) int openingStock,
            @NotBlank @Size(max = 24) String unit,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            @Min(0) int lowStockThreshold,
            @Pattern(regexp = "(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}

    public record LowStockThresholdRequest(@Min(0) int lowStockThreshold) {}

    public record ItemUpdate(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Size(max = 100) String category,
            @NotBlank @Size(max = 24) String unit,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            boolean active,
            @Pattern(regexp = "(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}

    public record ItemView(UUID id, String sku, String name, String category, int stock, String unit,
                           String price, String state, String mark, String tone, BigDecimal unitPrice,
                           int reserved, int available, int lowStockThreshold, String itemType) {}
}
