package si.spindl.sales;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.WarehouseEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="sales_order_lines",uniqueConstraints=@UniqueConstraint(name="uk_sales_order_line_item",columnNames={"sales_order_id","item_id"}))
public class SalesOrderLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sales_order_id",nullable=false) private SalesOrderEntity salesOrder;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="quote_line_id",nullable=false) private SalesQuoteLineEntity quoteLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(nullable=false) private int quantity;
    @Column(name="shipped_quantity",nullable=false) private int shippedQuantity;
    @Column(name="invoiced_quantity",nullable=false) private int invoicedQuantity;
    @Column(name="reserved_quantity",nullable=false) private int reservedQuantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    protected SalesOrderLineEntity(){}
    SalesOrderLineEntity(UUID tenantId,SalesOrderEntity order,SalesQuoteLineEntity quoteLine,WarehouseEntity warehouse){this.tenantId=tenantId;this.salesOrder=order;this.quoteLine=quoteLine;this.item=quoteLine.getItem();this.warehouse=warehouse;this.quantity=quoteLine.getQuantity();this.reservedQuantity=quoteLine.getQuantity();this.unitPrice=quoteLine.getUnitPrice();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public SalesOrderEntity getSalesOrder(){return salesOrder;} public ItemEntity getItem(){return item;} public WarehouseEntity getWarehouse(){return warehouse;} public int getQuantity(){return quantity;} public int getShippedQuantity(){return shippedQuantity;} public int getInvoicedQuantity(){return invoicedQuantity;} public int getInvoiceableQuantity(){return shippedQuantity-invoicedQuantity;} public int getReservedQuantity(){return reservedQuantity;} public BigDecimal getUnitPrice(){return unitPrice;}
    public boolean isFullyShipped(){return shippedQuantity>=quantity;}
    public void dispatch(int amount){if(amount<=0||amount>reservedQuantity)throw new IllegalArgumentException("Dispatch exceeds the reserved quantity");shippedQuantity+=amount;reservedQuantity-=amount;}
    public void invoiceShippedQuantity(int amount){if(amount<=0||amount>getInvoiceableQuantity())throw new IllegalArgumentException("Invoice quantity exceeds shipped uninvoiced quantity");invoicedQuantity+=amount;}
}
