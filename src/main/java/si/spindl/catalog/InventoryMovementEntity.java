package si.spindl.catalog;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import java.util.Objects;

@Entity
@Table(name="inventory_movements")
public class InventoryMovementEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="warehouse_id") private WarehouseEntity warehouse;
    @Column(name="quantity_delta",nullable=false) private int quantityDelta;
    @Column(nullable=false,length=300) private String reason;
    @Column(name="source_reference",nullable=false,length=120) private String sourceReference;
    @Column(name="idempotency_key",length=120) private String idempotencyKey;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected InventoryMovementEntity(){}
    public InventoryMovementEntity(UUID tenantId,ItemEntity item,int quantityDelta,String reason,String sourceReference){this.tenantId=tenantId;this.item=item;this.quantityDelta=quantityDelta;this.reason=reason;this.sourceReference=sourceReference;}
    public InventoryMovementEntity(UUID tenantId,ItemEntity item,int quantityDelta,String reason,String sourceReference,String idempotencyKey){this(tenantId,item,quantityDelta,reason,sourceReference);this.idempotencyKey=idempotencyKey;}
    public InventoryMovementEntity(UUID tenantId,ItemEntity item,WarehouseEntity warehouse,int quantityDelta,String reason,String sourceReference,String idempotencyKey){this(tenantId,item,quantityDelta,reason,sourceReference,idempotencyKey);this.warehouse=warehouse;}
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public ItemEntity getItem(){return item;} public WarehouseEntity getWarehouse(){return warehouse;} public int getQuantityDelta(){return quantityDelta;} public String getReason(){return reason;} public String getSourceReference(){return sourceReference;} public String getIdempotencyKey(){return idempotencyKey;} public Instant getCreatedAt(){return createdAt;}
    public boolean matches(UUID itemId,int delta,String requestedReason){return item.getId().equals(itemId)&&quantityDelta==delta&&Objects.equals(reason,requestedReason);}
    public boolean matches(UUID itemId,UUID warehouseId,int delta,String requestedReason){return matches(itemId,delta,requestedReason)&&warehouse!=null&&warehouse.getId().equals(warehouseId);}
}
