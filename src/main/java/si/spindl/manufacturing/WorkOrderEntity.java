package si.spindl.manufacturing;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.WarehouseEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity @Table(name="work_orders",uniqueConstraints={@UniqueConstraint(name="uk_work_orders_number",columnNames={"tenant_id","order_number"}),@UniqueConstraint(name="uk_work_orders_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class WorkOrderEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="order_number",nullable=false,length=64) private String orderNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="bom_id",nullable=false) private UUID bomId;
    @Column(name="finished_item_id",nullable=false) private UUID finishedItemId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="output_warehouse_id",nullable=false) private WarehouseEntity outputWarehouse;
    @Column(name="target_quantity",nullable=false) private int targetQuantity;
    @Column(name="good_quantity",nullable=false) private int goodQuantity;
    @Column(name="scrap_quantity",nullable=false) private int scrapQuantity;
    @Column(name="rework_quantity",nullable=false) private int reworkQuantity;
    @Column(nullable=false,length=24) private String status="DRAFT";
    @Column(name="planned_start") private LocalDate plannedStart;
    @Column(name="due_date") private LocalDate dueDate;
    @Column(nullable=false,length=16) private String priority;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected WorkOrderEntity(){}
    public WorkOrderEntity(UUID tenantId,String orderNumber,String idempotencyKey,UUID bomId,UUID finishedItemId,WarehouseEntity outputWarehouse,int targetQuantity,LocalDate plannedStart,LocalDate dueDate,String priority){this.tenantId=tenantId;this.orderNumber=orderNumber;this.idempotencyKey=idempotencyKey;this.bomId=bomId;this.finishedItemId=finishedItemId;this.outputWarehouse=outputWarehouse;this.targetQuantity=targetQuantity;this.plannedStart=plannedStart;this.dueDate=dueDate;this.priority=priority;}
    @PrePersist void created(){updatedAt=Instant.now();}@PreUpdate void changed(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getOrderNumber(){return orderNumber;} public String getIdempotencyKey(){return idempotencyKey;} public UUID getBomId(){return bomId;} public UUID getFinishedItemId(){return finishedItemId;} public WarehouseEntity getOutputWarehouse(){return outputWarehouse;} public int getTargetQuantity(){return targetQuantity;} public int getGoodQuantity(){return goodQuantity;} public int getScrapQuantity(){return scrapQuantity;} public int getReworkQuantity(){return reworkQuantity;} public String getStatus(){return status;} public LocalDate getPlannedStart(){return plannedStart;} public LocalDate getDueDate(){return dueDate;} public String getPriority(){return priority;} public Instant getCreatedAt(){return createdAt;}
    public void release(){status="RELEASED";} public void begin(){status="IN_PROGRESS";} public void pause(){status="PAUSED";} public void complete(){status="COMPLETED";} public void close(){status="CLOSED";} public void cancel(){status="CANCELLED";}
    public void recordOutput(int good,int scrap,int rework){goodQuantity=Math.addExact(goodQuantity,good);scrapQuantity=Math.addExact(scrapQuantity,scrap);reworkQuantity=Math.addExact(reworkQuantity,rework);refreshProductionStatus();}
    public void disposeRework(int quantity,int good,int scrap){if(quantity<=0||quantity>reworkQuantity||good+scrap!=quantity)throw new IllegalArgumentException("Rework disposition must match pending rework quantity");reworkQuantity-=quantity;goodQuantity=Math.addExact(goodQuantity,good);scrapQuantity=Math.addExact(scrapQuantity,scrap);refreshProductionStatus();}
    private void refreshProductionStatus(){if(goodQuantity+scrapQuantity>=targetQuantity&&reworkQuantity==0)status="COMPLETED";else status="IN_PROGRESS";}
    public boolean matches(UUID bom,int quantity,LocalDate start,LocalDate due,String requestedPriority,UUID requestedOutputWarehouseId){return bomId.equals(bom)&&targetQuantity==quantity&&java.util.Objects.equals(plannedStart,start)&&java.util.Objects.equals(dueDate,due)&&priority.equals(requestedPriority)&&outputWarehouse.getId().equals(requestedOutputWarehouseId);}
}
