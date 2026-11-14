package si.spindl.purchasing;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="purchase_returns",uniqueConstraints={
        @UniqueConstraint(name="uk_purchase_returns_tenant_number",columnNames={"tenant_id","return_number"}),
        @UniqueConstraint(name="uk_purchase_returns_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class PurchaseReturnEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_id",nullable=false) private PurchaseOrderEntity purchaseOrder;
    @Column(name="return_number",nullable=false,length=64) private String returnNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,length=500) private String reason;
    @Column(name="returned_at",nullable=false,updatable=false) private Instant returnedAt;
    @OneToMany(mappedBy="purchaseReturn",cascade=CascadeType.ALL,orphanRemoval=true) private List<PurchaseReturnLineEntity> lines=new ArrayList<>();
    protected PurchaseReturnEntity(){}
    public PurchaseReturnEntity(UUID tenantId,PurchaseOrderEntity order,String number,String key,String reason){this.tenantId=tenantId;this.purchaseOrder=order;this.returnNumber=number;this.idempotencyKey=key;this.reason=reason;}
    public void addLine(PurchaseOrderLineEntity line,int quantity){lines.add(new PurchaseReturnLineEntity(tenantId,this,line,quantity));}
    @PrePersist void onCreate(){returnedAt=Instant.now();}
    public UUID getId(){return id;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public String getReturnNumber(){return returnNumber;} public String getReason(){return reason;} public Instant getReturnedAt(){return returnedAt;} public List<PurchaseReturnLineEntity> getLines(){return lines;} public int getReturnedUnits(){return lines.stream().mapToInt(PurchaseReturnLineEntity::getQuantity).sum();}
    public boolean matches(UUID orderId,String requestedReason,java.util.List<PurchaseOrderDtos.ReturnLine> requestedLines){java.util.Map<UUID,Integer> requested=new java.util.HashMap<>();requestedLines.forEach(line->requested.put(line.purchaseOrderLineId(),line.quantity()));java.util.Map<UUID,Integer> stored=new java.util.HashMap<>();lines.forEach(line->stored.put(line.getPurchaseOrderLine().getId(),line.getQuantity()));return purchaseOrder.getId().equals(orderId)&&reason.equals(requestedReason)&&stored.equals(requested);}
}
