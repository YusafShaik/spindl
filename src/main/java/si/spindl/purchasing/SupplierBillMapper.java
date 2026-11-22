package si.spindl.purchasing;

import si.spindl.purchasing.SupplierBillDtos.BillLineView;
import si.spindl.purchasing.SupplierBillDtos.BillView;
import si.spindl.purchasing.SupplierBillDtos.CreditNoteView;

/** Entity and row mapping for SupplierBillDtos. The records themselves stay free of persistence types. */
public final class SupplierBillMapper {
    private SupplierBillMapper() {}

    public static CreditNoteView toCreditNoteView(SupplierCreditNoteEntity note) {
return new CreditNoteView(note.getId(),note.getCreditNumber(),note.getBill().getId(),note.getBill().getBillNumber(),note.getPurchaseOrder().getId(),note.getPurchaseOrder().getOrderNumber(),note.getBill().getSupplier().getName(),note.getReason(),note.getTotal(),note.getCreditedUnits(),note.getIssuedAt());
    }

    public static BillLineView toBillLineView(SupplierBillLineEntity line) {
return new BillLineView(line.getId(),line.getSku(),line.getItemName(),line.getQuantity(),line.getCreditedQuantity(),line.getCreditAvailableQuantity(),line.getUnitPrice(),line.getLineTotal());
    }

    public static BillView toBillView(SupplierBillEntity bill) {
return new BillView(bill.getId(),bill.getBillNumber(),bill.getStatus(),bill.getPurchaseOrder().getId(),bill.getPurchaseOrder().getOrderNumber(),bill.getSupplier().getId(),bill.getSupplier().getName(),bill.getDueDate(),bill.getIssuedAt(),bill.getTotal(),bill.getAmountPaid(),bill.getAmountCredited(),bill.getBalance(),bill.getLines().stream().map(SupplierBillMapper::toBillLineView).toList());
    }
}
