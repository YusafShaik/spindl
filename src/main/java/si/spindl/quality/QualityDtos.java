package si.spindl.quality;

import java.util.UUID;
import java.time.Instant;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;

/** API contract for QualityService. Mapping to entities lives in the mapper, not here. */
public final class QualityDtos {
    private QualityDtos() {}

    public record SetInspectionRequest(boolean required) {}

    public record InspectRequest(@NotBlank String outcome,@Min(1) int quantity,@Size(max=500) String notes,@NotBlank @Size(max=120) String idempotencyKey) {}

    public record ItemQualityView(UUID id,String sku,String name,String unit,boolean inspectionRequired,int onHand,int heldQuantity,int availableQuantity) {}

    public record QualityLotView(UUID id,UUID itemId,String sku,String itemName,String warehouseCode,String warehouseName,String sourceType,String sourceReference,int quantity,int remainingQuantity,int passedQuantity,int rejectedQuantity,String status,java.time.Instant createdAt) {}
}
