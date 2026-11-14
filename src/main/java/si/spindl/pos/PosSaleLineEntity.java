package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.ItemEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name="pos_sale_lines",uniqueConstraints=@UniqueConstraint(name="uk_pos_sale_lines_tenant_id",columnNames={"tenant_id","id"}))
public class PosSaleLineEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sale_id",nullable=false) private PosSaleEntity sale;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(nullable=false,length=64) private String sku;
    @Column(name="item_name",nullable=false,length=180) private String itemName;
    @Column(nullable=false) private int quantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    @Column(name="list_unit_price",nullable=false,precision=14,scale=2) private BigDecimal listUnitPrice;
    @Column(name="discount_percent",nullable=false,precision=5,scale=2) private BigDecimal discountPercent=BigDecimal.ZERO;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="refunded_quantity",nullable=false) private int refundedQuantity;
    @Column(name="refunded_subtotal",nullable=false,precision=14,scale=2) private BigDecimal refundedSubtotal=BigDecimal.ZERO;
    @Column(name="refunded_tax_total",nullable=false,precision=14,scale=2) private BigDecimal refundedTaxTotal=BigDecimal.ZERO;
    protected PosSaleLineEntity(){}
    public PosSaleLineEntity(UUID tenantId,PosSaleEntity sale,ItemEntity item,int quantity,BigDecimal listUnitPrice,BigDecimal discountPercent,BigDecimal unitPrice,BigDecimal subtotal,BigDecimal taxTotal){this.tenantId=tenantId;this.sale=sale;this.item=item;this.sku=item.getSku();this.itemName=item.getName();this.quantity=quantity;this.listUnitPrice=listUnitPrice;this.discountPercent=discountPercent;this.unitPrice=unitPrice;this.subtotal=subtotal;this.taxTotal=taxTotal;this.total=subtotal.add(taxTotal);}
    public void addRefund(int quantity,BigDecimal subtotal,BigDecimal taxTotal){if(quantity<=0||quantity>getRefundableQuantity()||subtotal.signum()<=0||refundedSubtotal.add(subtotal).compareTo(this.subtotal)>0||refundedTaxTotal.add(taxTotal).compareTo(this.taxTotal)>0)throw new IllegalArgumentException("Refund exceeds the remaining sale line");refundedQuantity=Math.addExact(refundedQuantity,quantity);refundedSubtotal=refundedSubtotal.add(subtotal);refundedTaxTotal=refundedTaxTotal.add(taxTotal);}
    public int getRefundableQuantity(){return quantity-refundedQuantity;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PosSaleEntity getSale(){return sale;} public ItemEntity getItem(){return item;} public String getSku(){return sku;} public String getItemName(){return itemName;} public int getQuantity(){return quantity;} public int getRefundedQuantity(){return refundedQuantity;} public BigDecimal getRefundedSubtotal(){return refundedSubtotal;} public BigDecimal getRefundedTaxTotal(){return refundedTaxTotal;} public BigDecimal getRefundableSubtotal(){return subtotal.subtract(refundedSubtotal);} public BigDecimal getRefundableTaxTotal(){return taxTotal.subtract(refundedTaxTotal);} public BigDecimal getUnitPrice(){return unitPrice;} public BigDecimal getListUnitPrice(){return listUnitPrice;} public BigDecimal getDiscountPercent(){return discountPercent;} public BigDecimal getSubtotal(){return subtotal;} public BigDecimal getTaxTotal(){return taxTotal;} public BigDecimal getTotal(){return total;}
}
