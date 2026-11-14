package si.spindl.purchasing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="supplier_bill_lines")
public class SupplierBillLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_bill_id",nullable=false) private SupplierBillEntity bill;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_line_id",nullable=false) private PurchaseOrderLineEntity purchaseOrderLine;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false) private int quantity;
    @Column(name="credited_quantity",nullable=false) private int creditedQuantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    @Column(name="line_total",nullable=false,precision=14,scale=2) private BigDecimal lineTotal;
    protected SupplierBillLineEntity(){}
    SupplierBillLineEntity(UUID tenantId,SupplierBillEntity bill,PurchaseOrderLineEntity line,int quantity){this.tenantId=tenantId;this.bill=bill;this.purchaseOrderLine=line;this.sku=line.getItem().getSku();this.itemName=line.getItem().getName();this.quantity=quantity;this.unitPrice=line.getUnitPrice();this.lineTotal=unitPrice.multiply(BigDecimal.valueOf(quantity));}
    public UUID getId(){return id;} public PurchaseOrderLineEntity getPurchaseOrderLine(){return purchaseOrderLine;} public String getSku(){return sku;} public String getItemName(){return itemName;} public int getQuantity(){return quantity;} public int getCreditedQuantity(){return creditedQuantity;} public int getCreditAvailableQuantity(){return quantity-creditedQuantity;} public BigDecimal getUnitPrice(){return unitPrice;} public BigDecimal getLineTotal(){return lineTotal;}
    public void credit(int qty){if(qty<=0||qty>getCreditAvailableQuantity())throw new IllegalArgumentException("Credit quantity exceeds uncredited bill quantity");creditedQuantity+=qty;}
}
