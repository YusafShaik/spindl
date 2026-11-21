package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="inventory_cycle_counts")
public class InventoryCycleCountEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=120) private String name;
    @Column(nullable=false,length=16) private String status="COUNTING";
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(length=500) private String notes;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="submitted_at") private Instant submittedAt;
    @Column(name="posted_at") private Instant postedAt;

    protected InventoryCycleCountEntity() {}
    public InventoryCycleCountEntity(UUID tenantId,String name,String notes,UUID createdBy,WarehouseEntity warehouse){this.tenantId=tenantId;this.name=name;this.notes=notes;this.createdBy=createdBy;this.warehouse=warehouse;}
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getName(){return name;} public String getStatus(){return status;} public String getNotes(){return notes;} public UUID getCreatedBy(){return createdBy;} public Instant getCreatedAt(){return createdAt;} public Instant getSubmittedAt(){return submittedAt;} public Instant getPostedAt(){return postedAt;} public WarehouseEntity getWarehouse(){return warehouse;}
    public void submit(){status="REVIEW";submittedAt=Instant.now();}
    public void post(){status="POSTED";postedAt=Instant.now();}
    public void cancel(){status="CANCELLED";}
}
