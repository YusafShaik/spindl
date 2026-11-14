package si.spindl.purchasing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class PurchaseOrderDtos {
    private PurchaseOrderDtos() {}

    public record CreateOrderRequest(@NotNull UUID supplierId,@NotEmpty List<@Valid LineRequest> lines,@Size(max=1000) String notes) {}
    public record LineRequest(@NotNull UUID itemId,@Min(1) int quantity,@NotNull @DecimalMin("0.00") BigDecimal unitPrice) {}
    public record ReceiveRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotEmpty List<@Valid ReceiveLine> lines) {}
    public record ReceiveLine(@NotNull UUID purchaseOrderLineId,@Min(0) int acceptedQuantity,@Min(0) int rejectedQuantity,UUID warehouseId) {}
    public record PurchaseOrderView(UUID id,String orderNumber,String status,UUID supplierId,String supplierName,String notes,Instant createdAt,BigDecimal total,List<OrderLineView> lines) {
        static PurchaseOrderView from(PurchaseOrderEntity order){return new PurchaseOrderView(order.getId(),order.getOrderNumber(),order.getStatus(),order.getSupplier().getId(),order.getSupplier().getName(),order.getNotes(),order.getCreatedAt(),order.getTotal(),order.getLines().stream().map(OrderLineView::from).toList());}
    }
    public record ReorderSuggestion(UUID itemId,String sku,String itemName,String unit,int availableQuantity,int reorderThreshold,int incomingQuantity,int suggestedQuantity){}
    public record OrderLineView(UUID id,UUID itemId,String sku,String itemName,int orderedQuantity,int receivedQuantity,int acceptedQuantity,int returnedQuantity,int returnableQuantity,int billedQuantity,int billableQuantity,BigDecimal unitPrice) {
        static OrderLineView from(PurchaseOrderLineEntity line){return new OrderLineView(line.getId(),line.getItem().getId(),line.getItem().getSku(),line.getItem().getName(),line.getOrderedQuantity(),line.getReceivedQuantity(),line.getAcceptedQuantity(),line.getReturnedQuantity(),line.getReturnableQuantity(),line.getBilledQuantity(),line.getBillableQuantity(),line.getUnitPrice());}
    }
    public record ReceiptView(UUID id,UUID purchaseOrderId,String orderNumber,String receiptNumber,String idempotencyKey,int postedUnits,Instant receivedAt) {
        static ReceiptView from(GoodsReceiptEntity receipt){return new ReceiptView(receipt.getId(),receipt.getPurchaseOrder().getId(),receipt.getPurchaseOrder().getOrderNumber(),receipt.getReceiptNumber(),receipt.getIdempotencyKey(),receipt.getPostedUnits(),receipt.getReceivedAt());}
    }
    public record ReturnRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotBlank @Size(max=500) String reason,@NotEmpty List<@Valid ReturnLine> lines){}
    public record ReturnLine(@NotNull UUID purchaseOrderLineId,@Min(1) int quantity){}
    public record ReturnView(UUID id,UUID purchaseOrderId,String orderNumber,String returnNumber,String reason,int returnedUnits,Instant returnedAt){static ReturnView from(PurchaseReturnEntity ret){return new ReturnView(ret.getId(),ret.getPurchaseOrder().getId(),ret.getPurchaseOrder().getOrderNumber(),ret.getReturnNumber(),ret.getReason(),ret.getReturnedUnits(),ret.getReturnedAt());}}
}
