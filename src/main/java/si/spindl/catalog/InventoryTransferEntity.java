package si.spindl.catalog;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name="inventory_transfers",uniqueConstraints=@UniqueConstraint(name="uk_inventory_transfers_tenant_idempotency",columnNames={"tenant_id","idempotency_key"}))
public class InventoryTransferEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="source_warehouse_id",nullable=false) private WarehouseEntity sourceWarehouse;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="destination_warehouse_id",nullable=false) private WarehouseEntity destinationWarehouse;
    @Column(nullable=false) private int quantity;
    @Column(nullable=false,length=240) private String reason;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,length=16) private String status="DRAFT";
    @Column(name="approved_by") private UUID approvedBy;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="approved_at") private Instant approvedAt;
    @Column(name="dispatched_at") private Instant dispatchedAt;
    @Column(name="received_at") private Instant receivedAt;
    protected InventoryTransferEntity(){}
    public InventoryTransferEntity(UUID tenantId,ItemEntity item,WarehouseEntity source,WarehouseEntity destination,int quantity,String reason,String key){this.tenantId=tenantId;this.item=item;this.sourceWarehouse=source;this.destinationWarehouse=destination;this.quantity=quantity;this.reason=reason;this.idempotencyKey=key;}
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public ItemEntity getItem(){return item;} public WarehouseEntity getSourceWarehouse(){return sourceWarehouse;} public WarehouseEntity getDestinationWarehouse(){return destinationWarehouse;} public int getQuantity(){return quantity;} public String getReason(){return reason;} public String getIdempotencyKey(){return idempotencyKey;} public String getStatus(){return status;} public UUID getApprovedBy(){return approvedBy;} public Instant getCreatedAt(){return createdAt;} public Instant getApprovedAt(){return approvedAt;} public Instant getDispatchedAt(){return dispatchedAt;} public Instant getReceivedAt(){return receivedAt;}
    public void approve(UUID actorId){status="APPROVED";approvedBy=actorId;approvedAt=Instant.now();}
    public void dispatch(){status="IN_TRANSIT";dispatchedAt=Instant.now();}
    public void receive(){status="RECEIVED";receivedAt=Instant.now();}
    public void cancel(){status="CANCELLED";}
    public boolean matches(UUID itemId,UUID sourceId,UUID destinationId,int requestedQuantity,String requestedReason){return item.getId().equals(itemId)&&sourceWarehouse.getId().equals(sourceId)&&destinationWarehouse.getId().equals(destinationId)&&quantity==requestedQuantity&&Objects.equals(reason,requestedReason);}
}
