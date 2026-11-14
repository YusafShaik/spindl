package si.spindl.sales;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name="sales_quote_lines",uniqueConstraints=@UniqueConstraint(name="uk_sales_quote_line_item",columnNames={"quote_id","item_id"}))
public class SalesQuoteLineEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="quote_id",nullable=false) private SalesQuoteEntity quote;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @Column(nullable=false) private int quantity;
    @Column(name="unit_price",nullable=false,precision=14,scale=2) private BigDecimal unitPrice;
    protected SalesQuoteLineEntity(){}
    SalesQuoteLineEntity(UUID tenantId,SalesQuoteEntity quote,ItemEntity item,int quantity,BigDecimal unitPrice){this.tenantId=tenantId;this.quote=quote;this.item=item;this.quantity=quantity;this.unitPrice=unitPrice;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public SalesQuoteEntity getQuote(){return quote;} public ItemEntity getItem(){return item;} public int getQuantity(){return quantity;} public BigDecimal getUnitPrice(){return unitPrice;}
}
