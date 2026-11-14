package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="supplier_credit_note_lines")
public class SupplierCreditNoteLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_credit_note_id",nullable=false) private SupplierCreditNoteEntity creditNote;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_bill_line_id",nullable=false) private SupplierBillLineEntity billLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_line_id",nullable=false) private PurchaseOrderLineEntity purchaseOrderLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false) private int quantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    @Column(name="line_total",nullable=false,precision=14,scale=2) private BigDecimal lineTotal;
    protected SupplierCreditNoteLineEntity(){}
    SupplierCreditNoteLineEntity(UUID tenantId,SupplierCreditNoteEntity note,SupplierBillLineEntity billLine,int quantity){this.tenantId=tenantId;this.creditNote=note;this.billLine=billLine;this.purchaseOrderLine=billLine.getPurchaseOrderLine();this.item=purchaseOrderLine.getItem();this.sku=billLine.getSku();this.itemName=billLine.getItemName();this.quantity=quantity;this.unitPrice=billLine.getUnitPrice();this.lineTotal=unitPrice.multiply(BigDecimal.valueOf(quantity));}
    public SupplierBillLineEntity getBillLine(){return billLine;} public int getQuantity(){return quantity;}
}
