package si.spindl.finance;

import jakarta.persistence.*;
import si.spindl.inventory.WarehouseEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="customer_credit_note_lines",uniqueConstraints=@UniqueConstraint(name="uk_customer_credit_note_invoice_line",columnNames={"credit_note_id","invoice_line_id"}))
public class CustomerCreditNoteLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="credit_note_id",nullable=false) private CustomerCreditNoteEntity creditNote;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="invoice_line_id",nullable=false) private InvoiceLineEntity invoiceLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false) private int quantity;
    @Column(nullable=false,length=16) private String disposition;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    @Column(name="tax_rate",nullable=false,precision=5,scale=2) private BigDecimal taxRate;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_amount",nullable=false,precision=14,scale=2) private BigDecimal taxAmount;
    @Column(name="line_total",nullable=false,precision=14,scale=2) private BigDecimal lineTotal;
    protected CustomerCreditNoteLineEntity(){}
    CustomerCreditNoteLineEntity(UUID tenantId,CustomerCreditNoteEntity note,InvoiceLineEntity invoiceLine,int quantity,String disposition,BigDecimal subtotal,BigDecimal taxAmount,BigDecimal total){this.tenantId=tenantId;this.creditNote=note;this.invoiceLine=invoiceLine;this.warehouse=invoiceLine.getSalesOrderLine().getWarehouse();this.sku=invoiceLine.getSku();this.itemName=invoiceLine.getItemName();this.quantity=quantity;this.disposition=disposition;this.unitPrice=invoiceLine.getUnitPrice();this.taxRate=invoiceLine.getTaxRate();this.subtotal=subtotal;this.taxAmount=taxAmount;this.lineTotal=total;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public CustomerCreditNoteEntity getCreditNote(){return creditNote;}public InvoiceLineEntity getInvoiceLine(){return invoiceLine;}public WarehouseEntity getWarehouse(){return warehouse;}public String getSku(){return sku;}public String getItemName(){return itemName;}public int getQuantity(){return quantity;}public String getDisposition(){return disposition;}public BigDecimal getUnitPrice(){return unitPrice;}public BigDecimal getTaxRate(){return taxRate;}public BigDecimal getSubtotal(){return subtotal;}public BigDecimal getTaxAmount(){return taxAmount;}public BigDecimal getLineTotal(){return lineTotal;}
}
