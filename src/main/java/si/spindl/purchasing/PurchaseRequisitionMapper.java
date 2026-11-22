package si.spindl.purchasing;

import si.spindl.purchasing.PurchaseRequisitionDtos.LineView;
import si.spindl.purchasing.PurchaseRequisitionDtos.View;

/** Entity and row mapping for PurchaseRequisitionDtos. The records themselves stay free of persistence types. */
public final class PurchaseRequisitionMapper {
    private PurchaseRequisitionMapper() {}

    public static View toView(PurchaseRequisitionEntity requisition) {
var order=requisition.getPurchaseOrder();return new View(requisition.getId(),requisition.getRequisitionNumber(),requisition.getStatus(),requisition.getRequestedBy(),requisition.getNeedByDate(),requisition.getNotes(),requisition.getApprovedBy(),requisition.getApprovedAt(),requisition.getCreatedAt(),order==null?null:order.getId(),order==null?null:order.getOrderNumber(),requisition.getRejectionReason(),requisition.getLines().stream().map(line->new LineView(line.getId(),line.getItem().getId(),line.getItem().getSku(),line.getItem().getName(),line.getQuantity())).toList());
    }
}
