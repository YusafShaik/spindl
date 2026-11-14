package si.spindl.quality;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.WarehouseEntity;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="quality_lots",uniqueConstraints=@UniqueConstraint(name="uk_quality_lot_source",columnNames={"tenant_id","source_type","source_reference"}))
public class QualityLotEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="item_id",nullable=false) private ItemEntity item;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(name="source_type",nullable=false,length=24) private String sourceType;
    @Column(name="source_reference",nullable=false,length=120) private String sourceReference;
    @Column(nullable=false) private int quantity;
    @Column(name="remaining_quantity",nullable=false) private int remainingQuantity;
    @Column(name="passed_quantity",nullable=false) private int passedQuantity;
    @Column(name="rejected_quantity",nullable=false) private int rejectedQuantity;
    @Column(nullable=false,length=16) private String status="PENDING";
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected QualityLotEntity(){}
    public QualityLotEntity(UUID tenantId,ItemEntity item,WarehouseEntity warehouse,String sourceType,String sourceReference,int quantity){this.tenantId=tenantId;this.item=item;this.warehouse=warehouse;this.sourceType=sourceType;this.sourceReference=sourceReference;this.quantity=quantity;this.remainingQuantity=quantity;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public ItemEntity getItem(){return item;}public WarehouseEntity getWarehouse(){return warehouse;}public String getSourceType(){return sourceType;}public String getSourceReference(){return sourceReference;}public int getQuantity(){return quantity;}public int getRemainingQuantity(){return remainingQuantity;}public int getPassedQuantity(){return passedQuantity;}public int getRejectedQuantity(){return rejectedQuantity;}public String getStatus(){return status;}public Instant getCreatedAt(){return createdAt;}
    public void inspect(String outcome,int amount){if(amount<=0||amount>remainingQuantity)throw new IllegalArgumentException("Inspection quantity exceeds the remaining lot quantity");remainingQuantity-=amount;if(outcome.equals("PASS"))passedQuantity+=amount;else rejectedQuantity+=amount;if(remainingQuantity>0)status="IN_PROGRESS";else if(rejectedQuantity==0)status="RELEASED";else if(passedQuantity==0)status="REJECTED";else status="MIXED";}
}
