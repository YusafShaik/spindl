package si.spindl.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/items")
public class ItemController {
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final DevelopmentTenant tenant;
    public ItemController(ItemRepository items, InventoryMovementRepository movements, DevelopmentTenant tenant) { this.items = items; this.movements=movements; this.tenant = tenant; }

    @GetMapping public List<ItemView> list() { return items.findAllByTenantIdAndActiveTrueOrderByName(tenant.currentTenantId()).stream().map(ItemView::from).toList(); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    public ItemView create(@Valid @RequestBody ItemRequest request) {
        if (items.existsByTenantIdAndSkuIgnoreCase(tenant.currentTenantId(), request.sku())) throw new ResponseStatusException(HttpStatus.CONFLICT, "SKU already exists");
        ItemEntity saved = items.save(new ItemEntity(tenant.currentTenantId(), request.sku().trim(), request.name().trim(), request.category().trim(), request.openingStock(), request.unit().trim(), request.unitPrice(),request.lowStockThreshold()));saved.updateType(request.itemType()==null||request.itemType().isBlank()?"FINISHED":request.itemType().trim().toUpperCase(java.util.Locale.ROOT));
        if (request.openingStock() > 0) {
            movements.save(new InventoryMovementEntity(tenant.currentTenantId(),saved,request.openingStock(),"Opening balance","OPENING-"+saved.getSku()));
        }
        return ItemView.from(saved);
    }

    @PutMapping("/{id}") @Transactional
    public ItemView update(@PathVariable UUID id, @Valid @RequestBody ItemUpdate request) {
        ItemEntity item = items.findByTenantIdAndId(tenant.currentTenantId(), id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        item.update(request.name().trim(), request.category().trim(), request.unit().trim(), request.unitPrice(), request.active());if(request.itemType()!=null)item.updateType(request.itemType().trim().toUpperCase(java.util.Locale.ROOT));
        return ItemView.from(items.save(item));
    }

    @PatchMapping("/{id}/low-stock-threshold") @Transactional
    public ItemView setLowStockThreshold(@PathVariable UUID id,@Valid @RequestBody LowStockThresholdRequest request){
        ItemEntity item=items.findByTenantIdAndId(tenant.currentTenantId(),id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        item.setLowStockThreshold(request.lowStockThreshold());
        return ItemView.from(items.save(item));
    }

    public record ItemRequest(@NotBlank @Size(max=64) String sku, @NotBlank @Size(max=180) String name,
                              @NotBlank @Size(max=100) String category, @Min(0) int openingStock,
                              @NotBlank @Size(max=24) String unit, @NotNull @DecimalMin("0.00") BigDecimal unitPrice,@Min(0) int lowStockThreshold,@jakarta.validation.constraints.Pattern(regexp="(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}
    public record LowStockThresholdRequest(@Min(0) int lowStockThreshold){}
    public record ItemUpdate(@NotBlank @Size(max=180) String name, @NotBlank @Size(max=100) String category,
                             @NotBlank @Size(max=24) String unit, @NotNull @DecimalMin("0.00") BigDecimal unitPrice, boolean active,@jakarta.validation.constraints.Pattern(regexp="(?i)(RAW|WIP|FINISHED|SERVICE)") String itemType) {}
    public record ItemView(UUID id, String sku, String name, String category, int stock, String unit, String price, String state, String mark, String tone, BigDecimal unitPrice, int reserved, int available,int lowStockThreshold,String itemType) {
        static ItemView from(ItemEntity i) {
            String availableState = i.getAvailableQuantity() == 0 ? "Out of stock" : i.getAvailableQuantity() <= i.getLowStockThreshold() ? "Low stock" : "In stock";
            String cleaned=i.getName().replaceAll("[^A-Za-z0-9 ]", "").trim();String[] initials = cleaned.isEmpty()?new String[]{"?"}:cleaned.split("\\s+");
            String mark = initials.length > 1 ? ("" + initials[0].charAt(0) + initials[1].charAt(0)).toUpperCase() : initials[0].substring(0, Math.min(2, initials[0].length())).toUpperCase();
            return new ItemView(i.getId(), i.getSku(), i.getName(), i.getCategory(), i.getOnHand(), i.getUnit(), "₹ " + i.getUnitPrice().stripTrailingZeros().toPlainString(), availableState, mark, "lavender", i.getUnitPrice(),i.getReservedQuantity(),i.getAvailableQuantity(),i.getLowStockThreshold(),i.getItemType());
        }
    }
}
