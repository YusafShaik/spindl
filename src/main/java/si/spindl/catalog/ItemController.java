package si.spindl.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/items")
@RequiredArgsConstructor
public class ItemController {
    private final ItemService itemService;
    private final DevelopmentTenant tenant;

    @GetMapping
    public List<ItemView> list() {
        return itemService.list(tenant.currentTenantId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItemView create(@Valid @RequestBody ItemRequest request) {
        return itemService.create(tenant.currentTenantId(), request);
    }

    @PutMapping("/{id}")
    public ItemView update(@PathVariable UUID id, @Valid @RequestBody ItemUpdate request) {
        return itemService.update(tenant.currentTenantId(), id, request);
    }

    @PatchMapping("/{id}/low-stock-threshold")
    public ItemView setLowStockThreshold(@PathVariable UUID id, @Valid @RequestBody LowStockThresholdRequest request) {
        return itemService.setLowStockThreshold(tenant.currentTenantId(), id, request);
    }

    public record ItemRequest(
            @NotBlank @Size(max = 64) String sku,
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Size(max = 100) String category,
            @Min(0) int openingStock,
            @NotBlank @Size(max = 24) String unit,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            @Min(0) int lowStockThreshold,
            @jakarta.validation.constraints.Pattern(regexp = "(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}

    public record LowStockThresholdRequest(@Min(0) int lowStockThreshold) {}

    public record ItemUpdate(
            @NotBlank @Size(max = 180) String name,
            @NotBlank @Size(max = 100) String category,
            @NotBlank @Size(max = 24) String unit,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            boolean active,
            @jakarta.validation.constraints.Pattern(regexp = "(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}

    public record ItemView(UUID id, String sku, String name, String category, int stock, String unit,
                           String price, String state, String mark, String tone, BigDecimal unitPrice,
                           int reserved, int available, int lowStockThreshold, String itemType) {
        public static ItemView from(ItemEntity i) {
            String availableState = i.getAvailableQuantity() == 0 ? "Out of stock" : i.getAvailableQuantity() <= i.getLowStockThreshold() ? "Low stock" : "In stock";
            String cleaned = i.getName().replaceAll("[^A-Za-z0-9 ]", "").trim();
            String[] initials = cleaned.isEmpty() ? new String[]{"?"} : cleaned.split("\\s+");
            String mark = initials.length > 1 ? ("" + initials[0].charAt(0) + initials[1].charAt(0)).toUpperCase() : initials[0].substring(0, Math.min(2, initials[0].length())).toUpperCase();
            return new ItemView(i.getId(), i.getSku(), i.getName(), i.getCategory(), i.getOnHand(), i.getUnit(), "₹ " + i.getUnitPrice().stripTrailingZeros().toPlainString(), availableState, mark, "lavender", i.getUnitPrice(), i.getReservedQuantity(), i.getAvailableQuantity(), i.getLowStockThreshold(), i.getItemType());
        }
    }
}
