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
    @Column(name = "item_id") private UUID itemId; // Nullable if external part
    @Column(name = "part_source", nullable = false, length = 20) private String partSource = "INTERNAL"; // INTERNAL, EXTERNAL
    @Column(name = "external_part_name") private String externalPartName;
    @Column(name = "external_part_number", length = 100) private String externalPartNumber;
    @Column(name = "supplier_name", length = 160) private String supplierName;
    @Column(name = "invoice_reference", length = 100) private String invoiceReference;
    @Column(name = "warehouse_id") private UUID warehouseId;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal quantity;
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2) private BigDecimal unitCost = BigDecimal.ZERO;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected MaintenancePartConsumptionEntity() {}

    public MaintenancePartConsumptionEntity(UUID tenantId, UUID workOrderId, UUID itemId, UUID warehouseId,
                                            BigDecimal quantity, BigDecimal unitCost,
                                            String partSource, String externalPartName, String externalPartNumber,
                                            String supplierName, String invoiceReference) {
        this.tenantId = tenantId;
        this.workOrderId = workOrderId;
        this.itemId = itemId;
        this.warehouseId = warehouseId;
        this.quantity = quantity;
        if (unitCost != null) this.unitCost = unitCost;
        if (partSource != null) this.partSource = partSource;
        this.externalPartName = externalPartName;
        this.externalPartNumber = externalPartNumber;
        this.supplierName = supplierName;
        this.invoiceReference = invoiceReference;
    }

    public MaintenancePartConsumptionEntity(UUID tenantId, UUID workOrderId, UUID itemId, UUID warehouseId,
                                            BigDecimal quantity, BigDecimal unitCost) {
        this(tenantId, workOrderId, itemId, warehouseId, quantity, unitCost, "INTERNAL", null, null, null, null);
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getWorkOrderId() { return workOrderId; }
    public UUID getItemId() { return itemId; }
    public String getPartSource() { return partSource != null ? partSource : "INTERNAL"; }
    public String getExternalPartName() { return externalPartName; }
    public String getExternalPartNumber() { return externalPartNumber; }
    public String getSupplierName() { return supplierName; }
    public String getInvoiceReference() { return invoiceReference; }
    public UUID getWarehouseId() { return warehouseId; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getUnitCost() { return unitCost; }
    public Instant getCreatedAt() { return createdAt; }
}
