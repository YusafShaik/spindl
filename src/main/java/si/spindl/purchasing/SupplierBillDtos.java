package si.spindl.purchasing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class SupplierBillDtos {
    private SupplierBillDtos(){}
    public record IssueRequest(@NotBlank @Size(max=120) String idempotencyKey,LocalDate dueDate){}
    public record PaymentRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotNull @DecimalMin("0.01") BigDecimal amount,@NotBlank @Size(max=32) String method,@Size(max=120) String reference){}
    public record CreditRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotBlank @Size(max=500) String reason,@jakarta.validation.constraints.NotEmpty List<@jakarta.validation.Valid CreditLine> lines){}
    public record CreditLine(@NotNull UUID supplierBillLineId,@jakarta.validation.constraints.Min(1) int quantity){}
    public record BillView(UUID id,String billNumber,String status,UUID purchaseOrderId,String orderNumber,UUID supplierId,String supplierName,LocalDate dueDate,Instant issuedAt,BigDecimal total,BigDecimal amountPaid,BigDecimal amountCredited,BigDecimal balance,List<BillLineView> lines){
        static BillView from(SupplierBillEntity bill){return new BillView(bill.getId(),bill.getBillNumber(),bill.getStatus(),bill.getPurchaseOrder().getId(),bill.getPurchaseOrder().getOrderNumber(),bill.getSupplier().getId(),bill.getSupplier().getName(),bill.getDueDate(),bill.getIssuedAt(),bill.getTotal(),bill.getAmountPaid(),bill.getAmountCredited(),bill.getBalance(),bill.getLines().stream().map(BillLineView::from).toList());}
    }
    public record BillLineView(UUID id,String sku,String itemName,int quantity,int creditedQuantity,int creditableQuantity,BigDecimal unitPrice,BigDecimal lineTotal){static BillLineView from(SupplierBillLineEntity line){return new BillLineView(line.getId(),line.getSku(),line.getItemName(),line.getQuantity(),line.getCreditedQuantity(),line.getCreditAvailableQuantity(),line.getUnitPrice(),line.getLineTotal());}}
    public record CreditNoteView(UUID id,String creditNumber,UUID supplierBillId,String billNumber,UUID purchaseOrderId,String orderNumber,String supplierName,String reason,BigDecimal total,int creditedUnits,Instant issuedAt){static CreditNoteView from(SupplierCreditNoteEntity note){return new CreditNoteView(note.getId(),note.getCreditNumber(),note.getBill().getId(),note.getBill().getBillNumber(),note.getPurchaseOrder().getId(),note.getPurchaseOrder().getOrderNumber(),note.getBill().getSupplier().getName(),note.getReason(),note.getTotal(),note.getCreditedUnits(),note.getIssuedAt());}}
}
