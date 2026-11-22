package si.spindl.inventory;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;
import java.time.Instant;

/** API contract for InventoryWarehouseService. Mapping to entities lives in the mapper, not here. */
public final class InventoryWarehouseDtos {
    private InventoryWarehouseDtos() {}

    public record CreateWarehouseRequest(@NotBlank @Size(max=32) String code,@NotBlank @Size(max=120) String name,UUID branchId) {}

    public record TransferRequest(@NotNull UUID itemId,@NotNull UUID sourceWarehouseId,@NotNull UUID destinationWarehouseId,@Min(1) int quantity,@NotBlank @Size(max=240) String reason,@NotBlank @Size(max=120) String idempotencyKey) {}

    public record WarehouseView(UUID id,String code,String name,boolean isDefault,UUID branchId) {}

    public record WarehouseStockView(UUID itemId,String sku,String itemName,String unit,int onHand,int reservedQuantity,int qualityHoldQuantity,int availableQuantity) {}

    public record TransferView(UUID id,String sku,String itemName,int quantity,String sourceCode,String sourceName,String destinationCode,String destinationName,String reason,String reference,String status,java.util.UUID approvedBy,java.time.Instant createdAt,java.time.Instant approvedAt,java.time.Instant dispatchedAt,java.time.Instant receivedAt) {}
}
