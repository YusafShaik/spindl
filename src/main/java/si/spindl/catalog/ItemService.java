package si.spindl.catalog;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ItemService {
    private final ItemRepository items;
    private final InventoryMovementRepository movements;

    @Transactional(readOnly = true)
    public List<ItemController.ItemView> list(UUID tenantId) {
        return items.findAllByTenantIdAndActiveTrueOrderByName(tenantId)
                .stream()
                .map(ItemController.ItemView::from)
                .toList();
    }

    @Transactional
    public ItemController.ItemView create(UUID tenantId, ItemController.ItemRequest request) {
        if (items.existsByTenantIdAndSkuIgnoreCase(tenantId, request.sku())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SKU already exists");
        }
        ItemEntity saved = items.save(new ItemEntity(
                tenantId,
                request.sku().trim(),
                request.name().trim(),
                request.category().trim(),
                request.openingStock(),
                request.unit().trim(),
                request.unitPrice(),
                request.lowStockThreshold()
        ));
        saved.updateType(request.itemType() == null || request.itemType().isBlank()
                ? "FINISHED"
                : request.itemType().trim().toUpperCase(Locale.ROOT));

        if (request.openingStock() > 0) {
            movements.save(new InventoryMovementEntity(tenantId, saved, request.openingStock(), "Opening balance", "OPENING-" + saved.getSku()));
        }
        return ItemController.ItemView.from(saved);
    }

    @Transactional
    public ItemController.ItemView update(UUID tenantId, UUID id, ItemController.ItemUpdate request) {
        ItemEntity item = items.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        item.update(request.name().trim(), request.category().trim(), request.unit().trim(), request.unitPrice(), request.active());
        if (request.itemType() != null) {
            item.updateType(request.itemType().trim().toUpperCase(Locale.ROOT));
        }
        return ItemController.ItemView.from(items.save(item));
    }

    @Transactional
    public ItemController.ItemView setLowStockThreshold(UUID tenantId, UUID id, ItemController.LowStockThresholdRequest request) {
        ItemEntity item = items.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        item.setLowStockThreshold(request.lowStockThreshold());
        return ItemController.ItemView.from(items.save(item));
    }
}
