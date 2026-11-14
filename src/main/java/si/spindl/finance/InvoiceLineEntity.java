package si.spindl.finance;

import jakarta.persistence.*;
import si.spindl.sales.SalesOrderLineEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="invoice_lines")
public class InvoiceLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="invoice_id",nullable=false) private InvoiceEntity invoice;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sales_order_line_id",nullable=false) private SalesOrderLineEntity salesOrderLine;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false) private int quantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    @Column(name="line_total",nullable=false,precision=14,scale=2) private BigDecimal lineTotal;
    @Column(name="tax_rate",nullable=false,precision=5,scale=2) private BigDecimal taxRate;
    @Column(name="tax_amount",nullable=false,precision=14,scale=2) private BigDecimal taxAmount;
    @Column(name="gross_total",nullable=false,precision=14,scale=2) private BigDecimal grossTotal;
    @Column(name="credited_quantity",nullable=false) private int creditedQuantity;
    @Column(name="credited_tax_amount",nullable=false,precision=14,scale=2) private BigDecimal creditedTaxAmount=BigDecimal.ZERO;
    protected InvoiceLineEntity(){}
    InvoiceLineEntity(UUID tenantId,InvoiceEntity invoice,SalesOrderLineEntity orderLine,int quantity,BigDecimal taxRate){this.tenantId=tenantId;this.invoice=invoice;this.salesOrderLine=orderLine;this.sku=orderLine.getItem().getSku();this.itemName=orderLine.getItem().getName();this.quantity=quantity;this.unitPrice=orderLine.getUnitPrice();this.lineTotal=unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2,java.math.RoundingMode.HALF_UP);this.taxRate=taxRate;this.taxAmount=lineTotal.multiply(taxRate).movePointLeft(2).setScale(2,java.math.RoundingMode.HALF_UP);this.grossTotal=lineTotal.add(taxAmount);}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public InvoiceEntity getInvoice(){return invoice;} public SalesOrderLineEntity getSalesOrderLine(){return salesOrderLine;} public String getSku(){return sku;} public String getItemName(){return itemName;} public int getQuantity(){return quantity;} public int getCreditedQuantity(){return creditedQuantity;} public int getCreditEligibleQuantity(){return quantity-creditedQuantity;} public BigDecimal getUnitPrice(){return unitPrice;} public BigDecimal getLineTotal(){return lineTotal;} public BigDecimal getTaxRate(){return taxRate;} public BigDecimal getTaxAmount(){return taxAmount;} public BigDecimal getGrossTotal(){return grossTotal;}public BigDecimal getCreditedTaxAmount(){return creditedTaxAmount;}
    public BigDecimal taxAmountForCredit(int amount){if(amount<=0||amount>getCreditEligibleQuantity())throw new IllegalArgumentException("Credit quantity exceeds the invoice line's eligible quantity");int cumulativeQuantity=Math.addExact(creditedQuantity,amount);BigDecimal cumulativeBase=unitPrice.multiply(BigDecimal.valueOf(cumulativeQuantity));BigDecimal targetTax=cumulativeBase.multiply(taxRate).movePointLeft(2).setScale(2,java.math.RoundingMode.HALF_UP);return targetTax.subtract(creditedTaxAmount).max(BigDecimal.ZERO);}
    public void credit(int amount,BigDecimal creditedTax){if(amount<=0||amount>getCreditEligibleQuantity())throw new IllegalArgumentException("Credit quantity exceeds the invoice line's eligible quantity");if(creditedTax.signum()<0||creditedTax.compareTo(taxAmount.subtract(creditedTaxAmount))>0)throw new IllegalArgumentException("Credit tax amount exceeds the remaining invoice line tax");creditedQuantity=Math.addExact(creditedQuantity,amount);creditedTaxAmount=creditedTaxAmount.add(creditedTax);}
}
