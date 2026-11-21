package si.spindl.sales;

import jakarta.persistence.*;
import si.spindl.party.CustomerEntity;
import si.spindl.inventory.WarehouseEntity;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="sales_orders",uniqueConstraints={@UniqueConstraint(name="uk_sales_orders_tenant_number",columnNames={"tenant_id","order_number"}),@UniqueConstraint(name="uk_sales_orders_tenant_quote",columnNames={"tenant_id","quote_id"})})
public class SalesOrderEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="order_number",nullable=false,length=64) private String orderNumber;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="quote_id",nullable=false) private SalesQuoteEntity quote;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="customer_id",nullable=false) private CustomerEntity customer;
    @Column(nullable=false,length=32) private String status="confirmed";
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @OneToMany(mappedBy="salesOrder",cascade=CascadeType.ALL,orphanRemoval=true) private List<SalesOrderLineEntity> lines=new ArrayList<>();
    protected SalesOrderEntity(){}
    public SalesOrderEntity(UUID tenantId,String orderNumber,SalesQuoteEntity quote,CustomerEntity customer){this.tenantId=tenantId;this.orderNumber=orderNumber;this.quote=quote;this.customer=customer;}
    public void addLine(SalesQuoteLineEntity quoteLine,WarehouseEntity warehouse){lines.add(new SalesOrderLineEntity(tenantId,this,quoteLine,warehouse));}
    @PrePersist void onCreate(){createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void onUpdate(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getOrderNumber(){return orderNumber;} public SalesQuoteEntity getQuote(){return quote;} public CustomerEntity getCustomer(){return customer;} public String getStatus(){return status;} public Instant getCreatedAt(){return createdAt;} public List<SalesOrderLineEntity> getLines(){return lines;}
    public void refreshDispatchStatus(){status=lines.stream().allMatch(SalesOrderLineEntity::isFullyShipped)?"shipped":"partially_shipped";}
    public java.math.BigDecimal getTotal(){return lines.stream().map(line->line.getUnitPrice().multiply(java.math.BigDecimal.valueOf(line.getQuantity()))).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add);}
}
