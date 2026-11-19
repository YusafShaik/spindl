package si.spindl.maintenance;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "maintenance_parts_consumed", uniqueConstraints = {
    @UniqueConstraint(name = "uk_maintenance_parts_tenant_id", columnNames = {"tenant_id", "id"})
})
public class MaintenancePartConsumptionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "work_order_id", nullable = false) private UUID workOrderId;
    @Column(name = "item_id", nullable = false) private UUID itemId;
    @Column(name = "warehouse_id") private UUID warehouseId;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal quantity;
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2) private BigDecimal unitCost = BigDecimal.ZERO;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected MaintenancePartConsumptionEntity() {}

    public MaintenancePartConsumptionEntity(UUID tenantId, UUID workOrderId, UUID itemId, UUID warehouseId,
                                            BigDecimal quantity, BigDecimal unitCost) {
        this.tenantId = tenantId;
        this.workOrderId = workOrderId;
        this.itemId = itemId;
        this.warehouseId = warehouseId;
        this.quantity = quantity;
        if (unitCost != null) this.unitCost = unitCost;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getWorkOrderId() { return workOrderId; }
    public UUID getItemId() { return itemId; }
    public UUID getWarehouseId() { return warehouseId; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getUnitCost() { return unitCost; }
    public Instant getCreatedAt() { return createdAt; }
}
