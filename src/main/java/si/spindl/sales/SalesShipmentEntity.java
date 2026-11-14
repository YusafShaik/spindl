package si.spindl.sales;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="sales_shipments",uniqueConstraints={@UniqueConstraint(name="uk_sales_shipments_tenant_number",columnNames={"tenant_id","shipment_number"}),@UniqueConstraint(name="uk_sales_shipments_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class SalesShipmentEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sales_order_id",nullable=false) private SalesOrderEntity salesOrder;
    @Column(name="shipment_number",nullable=false,length=64) private String shipmentNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="shipped_at",nullable=false,updatable=false) private Instant shippedAt;
    @OneToMany(mappedBy="shipment",cascade=CascadeType.ALL,orphanRemoval=true) private List<SalesShipmentLineEntity> lines=new ArrayList<>();
    protected SalesShipmentEntity(){}
    public SalesShipmentEntity(UUID tenantId,SalesOrderEntity order,String number,String idempotencyKey){this.tenantId=tenantId;this.salesOrder=order;this.shipmentNumber=number;this.idempotencyKey=idempotencyKey;}
    public void addLine(SalesOrderLineEntity orderLine,int quantity){lines.add(new SalesShipmentLineEntity(tenantId,this,orderLine,quantity));}
    @PrePersist void onCreate(){shippedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public SalesOrderEntity getSalesOrder(){return salesOrder;} public String getShipmentNumber(){return shipmentNumber;} public String getIdempotencyKey(){return idempotencyKey;} public Instant getShippedAt(){return shippedAt;} public List<SalesShipmentLineEntity> getLines(){return lines;}
    public int getShippedUnits(){return lines.stream().mapToInt(SalesShipmentLineEntity::getQuantity).sum();}
}
