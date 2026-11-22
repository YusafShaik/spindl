package si.spindl.catalog;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.tenant.CurrentTenant;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/items")
@RequiredArgsConstructor
public class ItemController {
    private final ItemService itemService;
    private final CurrentTenant tenant;

    @GetMapping
    public List<ItemDtos.ItemView> list() {
        return itemService.list(tenant.currentTenantId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItemDtos.ItemView create(@Valid @RequestBody ItemDtos.ItemRequest request) {
        return itemService.create(tenant.currentTenantId(), request);
    }

    @PutMapping("/{id}")
    public ItemDtos.ItemView update(@PathVariable UUID id, @Valid @RequestBody ItemDtos.ItemUpdate request) {
        return itemService.update(tenant.currentTenantId(), id, request);
    }

    @PatchMapping("/{id}/low-stock-threshold")
    public ItemDtos.ItemView setLowStockThreshold(@PathVariable UUID id, @Valid @RequestBody ItemDtos.LowStockThresholdRequest request) {
        return itemService.setLowStockThreshold(tenant.currentTenantId(), id, request);
    }
}
