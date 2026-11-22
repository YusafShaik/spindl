package si.spindl.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
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

public final class SalesDtos {
    private SalesDtos(){}
    public record CreateQuoteRequest(@NotNull UUID customerId,@FutureOrPresent LocalDate validUntil,@Size(max=1000) String notes,@NotEmpty List<@Valid QuoteLineRequest> lines){}
    public record QuoteLineRequest(@NotNull UUID itemId,@Min(1) int quantity,@NotNull @DecimalMin("0.00") BigDecimal unitPrice){}
    public record ReservationLine(@NotNull UUID quoteLineId,@NotNull UUID warehouseId){}
    public record ConvertQuoteRequest(@Size(max=500) List<@Valid ReservationLine> lines){}
    public record QuoteView(UUID id,String quoteNumber,String status,UUID customerId,String customerName,LocalDate validUntil,String notes,Instant createdAt,BigDecimal total,List<QuoteLineView> lines) {}
    public record QuoteLineView(UUID id,UUID itemId,String sku,String itemName,int quantity,BigDecimal unitPrice) {}
    public record SalesOrderView(UUID id,String orderNumber,String status,String quoteNumber,UUID customerId,String customerName,Instant createdAt,BigDecimal total,List<SalesOrderLineView> lines) {}
    public record SalesOrderLineView(UUID id,UUID itemId,String sku,String itemName,int quantity,int shippedQuantity,int invoicedQuantity,int invoiceableQuantity,int reservedQuantity,UUID warehouseId,String warehouseCode,String warehouseName,BigDecimal unitPrice) {}
    public record DispatchRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotEmpty List<@Valid DispatchLine> lines){}
    public record DispatchLine(@NotNull UUID salesOrderLineId,@Min(1) int quantity){}
    public record ShipmentView(UUID id,UUID salesOrderId,String orderNumber,String shipmentNumber,String idempotencyKey,int shippedUnits,Instant shippedAt) {}
}
