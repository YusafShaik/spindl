package si.spindl.finance;

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

public final class CustomerCreditNoteDtos {
    private CustomerCreditNoteDtos() {
    }

    public record CreditLineRequest(@NotNull UUID invoiceLineId, @Min(1) int quantity,
                                    @NotBlank @Size(max = 16) String disposition) {
    }

    public record CreateCreditRequest(@NotBlank @Size(max = 120) String idempotencyKey,
                                      @NotBlank @Size(max = 500) String reason,
                                      @NotEmpty List<@Valid CreditLineRequest> lines) {
    }

    public record RefundRequest(@NotBlank @Size(max = 120) String idempotencyKey,
                                @NotNull @DecimalMin("0.01") BigDecimal amount, @NotBlank @Size(max = 32) String method,
                                @Size(max = 120) String reference) {
    }

    public record CreditNoteLineView(UUID id, UUID invoiceLineId, String sku, String itemName, int quantity,
                                     String disposition, String warehouseName, BigDecimal subtotal,
                                     BigDecimal taxAmount, BigDecimal total) {
    }

    public record CreditNoteView(UUID id, String creditNumber, String invoiceNumber, String customerName, String reason,
                                 BigDecimal subtotal, BigDecimal taxTotal, BigDecimal total, BigDecimal refundDue,
                                 BigDecimal amountRefunded, BigDecimal refundBalance, Instant issuedAt,
                                 List<CreditNoteLineView> lines) {
        static CreditNoteView from(CustomerCreditNoteEntity note) {
            return new CreditNoteView(note.getId(), note.getCreditNumber(), note.getInvoice().getInvoiceNumber(), note.getInvoice().getCustomer().getName(), note.getReason(), note.getSubtotal(), note.getTaxTotal(), note.getTotal(), note.getRefundDue(), note.getAmountRefunded(), note.getRefundBalance(), note.getIssuedAt(), note.getLines().stream().map(line -> new CreditNoteLineView(line.getId(), line.getInvoiceLine().getId(), line.getSku(), line.getItemName(), line.getQuantity(), line.getDisposition(), line.getWarehouse().getName(), line.getSubtotal(), line.getTaxAmount(), line.getLineTotal())).toList());
        }
    }
}
