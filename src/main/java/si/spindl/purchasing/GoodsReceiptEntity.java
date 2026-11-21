package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.inventory.WarehouseEntity;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="goods_receipts",uniqueConstraints={
        @UniqueConstraint(name="uk_goods_receipts_tenant_number",columnNames={"tenant_id","receipt_number"}),
        @UniqueConstraint(name="uk_goods_receipts_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class GoodsReceiptEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_id",nullable=false) private PurchaseOrderEntity purchaseOrder;
    @Column(name="receipt_number",nullable=false,length=64) private String receiptNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="received_at",nullable=false,updatable=false) private Instant receivedAt;
    @OneToMany(mappedBy="receipt",cascade=CascadeType.ALL,orphanRemoval=true) private List<GoodsReceiptLineEntity> lines=new ArrayList<>();
    protected GoodsReceiptEntity(){}
    public GoodsReceiptEntity(UUID tenantId,PurchaseOrderEntity order,String receiptNumber,String idempotencyKey){this.tenantId=tenantId;this.purchaseOrder=order;this.receiptNumber=receiptNumber;this.idempotencyKey=idempotencyKey;}
    public void addLine(PurchaseOrderLineEntity orderLine,WarehouseEntity warehouse,int accepted,int rejected){lines.add(new GoodsReceiptLineEntity(tenantId,this,orderLine,warehouse,accepted,rejected));}
    @PrePersist void onCreate(){receivedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public String getReceiptNumber(){return receiptNumber;} public String getIdempotencyKey(){return idempotencyKey;} public Instant getReceivedAt(){return receivedAt;} public List<GoodsReceiptLineEntity> getLines(){return lines;}
    public int getPostedUnits(){return lines.stream().mapToInt(GoodsReceiptLineEntity::getAcceptedQuantity).sum();}
}
