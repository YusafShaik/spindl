package si.spindl.sales;

import si.spindl.sales.SalesDtos.QuoteLineView;
import si.spindl.sales.SalesDtos.QuoteView;
import si.spindl.sales.SalesDtos.SalesOrderLineView;
import si.spindl.sales.SalesDtos.SalesOrderView;
import si.spindl.sales.SalesDtos.ShipmentView;

/** Entity and row mapping for SalesDtos. The records themselves stay free of persistence types. */
public final class SalesMapper {
    private SalesMapper() {}

    public static ShipmentView toShipmentView(SalesShipmentEntity s) {
return new ShipmentView(s.getId(),s.getSalesOrder().getId(),s.getSalesOrder().getOrderNumber(),s.getShipmentNumber(),s.getIdempotencyKey(),s.getShippedUnits(),s.getShippedAt());
    }

    public static SalesOrderLineView toSalesOrderLineView(SalesOrderLineEntity l) {
return new SalesOrderLineView(l.getId(),l.getItem().getId(),l.getItem().getSku(),l.getItem().getName(),l.getQuantity(),l.getShippedQuantity(),l.getInvoicedQuantity(),l.getInvoiceableQuantity(),l.getReservedQuantity(),l.getWarehouse().getId(),l.getWarehouse().getCode(),l.getWarehouse().getName(),l.getUnitPrice());
    }

    public static SalesOrderView toSalesOrderView(SalesOrderEntity o) {
return new SalesOrderView(o.getId(),o.getOrderNumber(),o.getStatus(),o.getQuote().getQuoteNumber(),o.getCustomer().getId(),o.getCustomer().getName(),o.getCreatedAt(),o.getTotal(),o.getLines().stream().map(SalesMapper::toSalesOrderLineView).toList());
    }

    public static QuoteLineView toQuoteLineView(SalesQuoteLineEntity l) {
return new QuoteLineView(l.getId(),l.getItem().getId(),l.getItem().getSku(),l.getItem().getName(),l.getQuantity(),l.getUnitPrice());
    }

    public static QuoteView toQuoteView(SalesQuoteEntity q) {
return new QuoteView(q.getId(),q.getQuoteNumber(),q.getStatus(),q.getCustomer().getId(),q.getCustomer().getName(),q.getValidUntil(),q.getNotes(),q.getCreatedAt(),q.getTotal(),q.getLines().stream().map(SalesMapper::toQuoteLineView).toList());
    }
}
