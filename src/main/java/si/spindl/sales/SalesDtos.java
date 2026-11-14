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
    public record QuoteView(UUID id,String quoteNumber,String status,UUID customerId,String customerName,LocalDate validUntil,String notes,Instant createdAt,BigDecimal total,List<QuoteLineView> lines){
        static QuoteView from(SalesQuoteEntity q){return new QuoteView(q.getId(),q.getQuoteNumber(),q.getStatus(),q.getCustomer().getId(),q.getCustomer().getName(),q.getValidUntil(),q.getNotes(),q.getCreatedAt(),q.getTotal(),q.getLines().stream().map(QuoteLineView::from).toList());}
    }
    public record QuoteLineView(UUID id,UUID itemId,String sku,String itemName,int quantity,BigDecimal unitPrice){static QuoteLineView from(SalesQuoteLineEntity l){return new QuoteLineView(l.getId(),l.getItem().getId(),l.getItem().getSku(),l.getItem().getName(),l.getQuantity(),l.getUnitPrice());}}
    public record SalesOrderView(UUID id,String orderNumber,String status,String quoteNumber,UUID customerId,String customerName,Instant createdAt,BigDecimal total,List<SalesOrderLineView> lines){
        static SalesOrderView from(SalesOrderEntity o){return new SalesOrderView(o.getId(),o.getOrderNumber(),o.getStatus(),o.getQuote().getQuoteNumber(),o.getCustomer().getId(),o.getCustomer().getName(),o.getCreatedAt(),o.getTotal(),o.getLines().stream().map(SalesOrderLineView::from).toList());}
    }
    public record SalesOrderLineView(UUID id,UUID itemId,String sku,String itemName,int quantity,int shippedQuantity,int invoicedQuantity,int invoiceableQuantity,int reservedQuantity,UUID warehouseId,String warehouseCode,String warehouseName,BigDecimal unitPrice){static SalesOrderLineView from(SalesOrderLineEntity l){return new SalesOrderLineView(l.getId(),l.getItem().getId(),l.getItem().getSku(),l.getItem().getName(),l.getQuantity(),l.getShippedQuantity(),l.getInvoicedQuantity(),l.getInvoiceableQuantity(),l.getReservedQuantity(),l.getWarehouse().getId(),l.getWarehouse().getCode(),l.getWarehouse().getName(),l.getUnitPrice());}}
    public record DispatchRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotEmpty List<@Valid DispatchLine> lines){}
    public record DispatchLine(@NotNull UUID salesOrderLineId,@Min(1) int quantity){}
    public record ShipmentView(UUID id,UUID salesOrderId,String orderNumber,String shipmentNumber,String idempotencyKey,int shippedUnits,Instant shippedAt){static ShipmentView from(SalesShipmentEntity s){return new ShipmentView(s.getId(),s.getSalesOrder().getId(),s.getSalesOrder().getOrderNumber(),s.getShipmentNumber(),s.getIdempotencyKey(),s.getShippedUnits(),s.getShippedAt());}}
}
