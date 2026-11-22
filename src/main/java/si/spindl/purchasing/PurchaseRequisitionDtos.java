package si.spindl.purchasing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PurchaseRequisitionDtos {
    private PurchaseRequisitionDtos(){}
    public record CreateRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotEmpty List<@Valid LineRequest> lines,LocalDate needByDate,@Size(max=1000) String notes){}
    public record LineRequest(@NotNull UUID itemId,@Min(1) int quantity){}
    public record RejectRequest(@NotBlank @Size(max=500) String reason){}
    public record ConvertLineRequest(@NotNull UUID requisitionLineId,@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal unitPrice){}
    public record ConvertRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotNull UUID supplierId,@NotEmpty List<@Valid ConvertLineRequest> lines){}
    public record LineView(UUID id,UUID itemId,String sku,String itemName,int quantity){}
    public record View(UUID id,String requisitionNumber,String status,UUID requestedBy,LocalDate needByDate,String notes,UUID approvedBy,Instant approvedAt,Instant createdAt,UUID purchaseOrderId,String purchaseOrderNumber,String rejectionReason,List<LineView> lines) {}
}
