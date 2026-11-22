package si.spindl.catalog;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
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
    public List<ItemDtos.ItemView> list(UUID tenantId) {
        return items.findAllByTenantIdAndActiveTrueOrderByName(tenantId)
                .stream()
                .map(ItemMapper::toView)
                .toList();
    }

    @Transactional
    public ItemDtos.ItemView create(UUID tenantId, ItemDtos.ItemRequest request) {
        if (items.existsByTenantIdAndSkuIgnoreCase(tenantId, request.sku())) {
            throw new ConflictException("SKU already exists");
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
        return ItemMapper.toView(saved);
    }

    @Transactional
    public ItemDtos.ItemView update(UUID tenantId, UUID id, ItemDtos.ItemUpdate request) {
        ItemEntity item = items.findByTenantIdAndId(tenantId, id)
                .orElseThrow(NotFoundException::new);
        item.update(request.name().trim(), request.category().trim(), request.unit().trim(), request.unitPrice(), request.active());
        if (request.itemType() != null) {
            item.updateType(request.itemType().trim().toUpperCase(Locale.ROOT));
        }
        return ItemMapper.toView(items.save(item));
    }

    @Transactional
    public ItemDtos.ItemView setLowStockThreshold(UUID tenantId, UUID id, ItemDtos.LowStockThresholdRequest request) {
        ItemEntity item = items.findByTenantIdAndId(tenantId, id)
                .orElseThrow(NotFoundException::new);
        item.setLowStockThreshold(request.lowStockThreshold());
        return ItemMapper.toView(items.save(item));
    }
}
