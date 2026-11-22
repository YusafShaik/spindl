package si.spindl.purchasing;

import si.spindl.purchasing.PurchaseOrderDtos.OrderLineView;
import si.spindl.purchasing.PurchaseOrderDtos.PurchaseOrderView;
import si.spindl.purchasing.PurchaseOrderDtos.ReceiptView;
import si.spindl.purchasing.PurchaseOrderDtos.ReturnView;

/** Entity and row mapping for PurchaseOrderDtos. The records themselves stay free of persistence types. */
public final class PurchaseOrderMapper {
    private PurchaseOrderMapper() {}

    public static ReturnView toReturnView(PurchaseReturnEntity ret) {
return new ReturnView(ret.getId(),ret.getPurchaseOrder().getId(),ret.getPurchaseOrder().getOrderNumber(),ret.getReturnNumber(),ret.getReason(),ret.getReturnedUnits(),ret.getReturnedAt());
    }

    public static ReceiptView toReceiptView(GoodsReceiptEntity receipt) {
return new ReceiptView(receipt.getId(),receipt.getPurchaseOrder().getId(),receipt.getPurchaseOrder().getOrderNumber(),receipt.getReceiptNumber(),receipt.getIdempotencyKey(),receipt.getPostedUnits(),receipt.getReceivedAt());
    }

    public static OrderLineView toOrderLineView(PurchaseOrderLineEntity line) {
return new OrderLineView(line.getId(),line.getItem().getId(),line.getItem().getSku(),line.getItem().getName(),line.getOrderedQuantity(),line.getReceivedQuantity(),line.getAcceptedQuantity(),line.getReturnedQuantity(),line.getReturnableQuantity(),line.getBilledQuantity(),line.getBillableQuantity(),line.getUnitPrice());
    }

    public static PurchaseOrderView toPurchaseOrderView(PurchaseOrderEntity order) {
return new PurchaseOrderView(order.getId(),order.getOrderNumber(),order.getStatus(),order.getSupplier().getId(),order.getSupplier().getName(),order.getNotes(),order.getCreatedAt(),order.getTotal(),order.getLines().stream().map(PurchaseOrderMapper::toOrderLineView).toList());
    }
}
