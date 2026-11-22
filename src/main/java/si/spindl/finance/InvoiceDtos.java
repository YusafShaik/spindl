package si.spindl.finance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class InvoiceDtos {
    private InvoiceDtos() {}

    public record IssueRequest(@NotBlank @Size(max=120) String idempotencyKey, LocalDate dueDate) {}
    public record PaymentRequest(@NotBlank @Size(max=120) String idempotencyKey,
                                 @NotNull @DecimalMin(value="0.01") BigDecimal amount,
                                 @NotBlank @Size(max=32) String method,
                                 @Size(max=120) String reference) {}
    public record FinanceSettingsUpdateRequest(@NotBlank @Pattern(regexp="[A-Za-z][A-Za-z0-9_-]{0,23}") String taxCode,@NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal taxRate,@NotBlank @Pattern(regexp="[A-Za-z0-9]{2,8}") String invoicePrefix) {}
    public record InvoiceView(UUID id, String invoiceNumber, String status, UUID salesOrderId,
                              String orderNumber, UUID customerId, String customerName,
                              LocalDate dueDate, Instant issuedAt, BigDecimal subtotal,String taxCode,BigDecimal taxRate,BigDecimal taxTotal,BigDecimal total,
                              BigDecimal amountPaid,BigDecimal creditTotal, BigDecimal balance, List<InvoiceLineView> lines) {}
    public record InvoiceLineView(UUID id, String sku, String itemName, int quantity,int creditedQuantity,int creditEligibleQuantity,
                                  BigDecimal unitPrice, BigDecimal lineTotal,BigDecimal taxRate,BigDecimal taxAmount,BigDecimal grossTotal) {}

    public record FinanceSettingsView(String taxCode,BigDecimal taxRate,String invoicePrefix,long nextInvoiceNumber) {}

    public record TaxSummaryView(String period,String taxCode,BigDecimal taxRate,BigDecimal subtotal,BigDecimal taxAmount,BigDecimal grossTotal) {}
}
