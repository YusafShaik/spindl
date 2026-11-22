package si.spindl.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** API contract for InventoryAdjustmentService. Mapping to entities lives in the mapper, not here. */
public final class InventoryAdjustmentDtos {
    private InventoryAdjustmentDtos() {}

    public record AdjustmentRequest(@NotNull UUID itemId,@NotNull Integer quantityDelta,@NotBlank @Size(max=80) String reason,@NotBlank @Size(max=120) String idempotencyKey,UUID warehouseId) {}

    public record MovementView(UUID id,UUID itemId,String sku,String itemName,UUID warehouseId,String warehouseCode,String warehouseName,int quantityDelta,String reason,String sourceReference,Instant createdAt) {}

    public record MovementSearchPage(List<MovementView> items,int page,int pageSize,long totalElements,int totalPages) {}
}
