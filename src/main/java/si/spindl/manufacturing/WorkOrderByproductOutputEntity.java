package si.spindl.manufacturing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Id;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="work_order_byproduct_outputs", uniqueConstraints=@UniqueConstraint(name="uk_work_order_byproduct_output_line", columnNames={"output_id","item_id","warehouse_id"}))
public class WorkOrderByproductOutputEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(name="output_id",nullable=false) private UUID outputId;
    @Column(name="item_id",nullable=false) private UUID itemId;
    @Column(name="warehouse_id",nullable=false) private UUID warehouseId;
    @Column(nullable=false) private int quantity;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WorkOrderByproductOutputEntity(){}
    public WorkOrderByproductOutputEntity(UUID tenantId,UUID workOrderId,UUID outputId,UUID itemId,UUID warehouseId,int quantity){this.tenantId=tenantId;this.workOrderId=workOrderId;this.outputId=outputId;this.itemId=itemId;this.warehouseId=warehouseId;this.quantity=quantity;}
}
