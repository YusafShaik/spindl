package si.spindl.manufacturing;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="work_order_material_operations")
public class WorkOrderMaterialOperationEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(name="material_line_id",nullable=false) private UUID materialLineId;
    @Column(nullable=false,length=16) private String operation;
    @Column(nullable=false) private int quantity;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="unit_cost",precision=14,scale=4) private java.math.BigDecimal unitCost;
    @Column(name="cost_amount",precision=14,scale=2) private java.math.BigDecimal costAmount;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WorkOrderMaterialOperationEntity(){}
    public WorkOrderMaterialOperationEntity(UUID tenantId,UUID workOrderId,UUID materialLineId,String operation,int quantity,String idempotencyKey,java.math.BigDecimal unitCost,java.math.BigDecimal costAmount){this.tenantId=tenantId;this.workOrderId=workOrderId;this.materialLineId=materialLineId;this.operation=operation;this.quantity=quantity;this.idempotencyKey=idempotencyKey;this.unitCost=unitCost;this.costAmount=costAmount;}
    public String getOperation(){return operation;} public UUID getMaterialLineId(){return materialLineId;} public UUID getWorkOrderId(){return workOrderId;} public int getQuantity(){return quantity;} public java.math.BigDecimal getUnitCost(){return unitCost;} public java.math.BigDecimal getCostAmount(){return costAmount;}
    public boolean matches(UUID orderId,UUID lineId,String kind,int qty){return workOrderId.equals(orderId)&&materialLineId.equals(lineId)&&operation.equals(kind)&&quantity==qty;}
}
