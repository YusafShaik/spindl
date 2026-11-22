package si.spindl.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import java.time.Instant;
import jakarta.validation.constraints.Min;

/** API contract for InventoryCycleCountService. Mapping to entities lives in the mapper, not here. */
public final class InventoryCycleCountDtos {
    private InventoryCycleCountDtos() {}

    public record CreateCycleCountRequest(@NotBlank @Size(max=120) String name,@Size(max=500) String notes,UUID warehouseId) {}

    public record RecordCountRequest(@NotNull @jakarta.validation.constraints.Min(0) Integer countedQuantity) {}

    public record CycleCountLineView(UUID id,UUID itemId,String sku,String itemName,String unit,int systemQuantity,Integer countedQuantity,Integer variance) {}

    public record CycleCountView(UUID id,String name,String status,String notes,UUID warehouseId,String warehouseCode,String warehouseName,UUID createdBy,java.time.Instant createdAt,java.time.Instant submittedAt,java.time.Instant postedAt,List<CycleCountLineView> lines) {}
}
