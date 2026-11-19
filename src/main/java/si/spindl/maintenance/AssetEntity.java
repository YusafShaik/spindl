package si.spindl.maintenance;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "maintenance_assets", uniqueConstraints = {
    @UniqueConstraint(name = "uk_maintenance_assets_tenant_code", columnNames = {"tenant_id", "code"}),
    @UniqueConstraint(name = "uk_maintenance_assets_tenant_id", columnNames = {"tenant_id", "id"})
})
public class AssetEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(nullable = false, length = 40) private String code;
    @Column(nullable = false, length = 120) private String name;
    @Column(name = "work_center_id") private UUID workCenterId;
    @Column(name = "serial_number", length = 100) private String serialNumber;
    @Column(length = 100) private String manufacturer;
    @Column(length = 100) private String model;
    @Column(nullable = false, length = 24) private String status = "OPERATIONAL";
    @Column(name = "meter_hours", nullable = false, precision = 10, scale = 2) private BigDecimal meterHours = BigDecimal.ZERO;
    @Column(name = "installation_date") private LocalDate installationDate;
    @Column(name = "warranty_expiry") private LocalDate warrantyExpiry;
    @Column(name = "last_service_date") private LocalDate lastServiceDate;
    @Column(name = "next_service_due_date") private LocalDate nextServiceDueDate;
    @Column(columnDefinition = "TEXT") private String notes;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected AssetEntity() {}

    public AssetEntity(UUID tenantId, String code, String name, UUID workCenterId, String serialNumber,
                       String manufacturer, String model, String status, BigDecimal meterHours,
                       LocalDate installationDate, LocalDate warrantyExpiry, LocalDate nextServiceDueDate, String notes) {
        this.tenantId = tenantId;
        this.code = code;
        this.name = name;
        this.workCenterId = workCenterId;
        this.serialNumber = serialNumber;
        this.manufacturer = manufacturer;
        this.model = model;
        if (status != null) this.status = status;
        if (meterHours != null) this.meterHours = meterHours;
        this.installationDate = installationDate;
        this.warrantyExpiry = warrantyExpiry;
        this.nextServiceDueDate = nextServiceDueDate;
        this.notes = notes;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public UUID getWorkCenterId() { return workCenterId; }
    public String getSerialNumber() { return serialNumber; }
    public String getManufacturer() { return manufacturer; }
    public String getModel() { return model; }
    public String getStatus() { return status; }
    public BigDecimal getMeterHours() { return meterHours; }
    public LocalDate getInstallationDate() { return installationDate; }
    public LocalDate getWarrantyExpiry() { return warrantyExpiry; }
    public LocalDate getLastServiceDate() { return lastServiceDate; }
    public LocalDate getNextServiceDueDate() { return nextServiceDueDate; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setStatus(String status) { this.status = status; }
    public void setMeterHours(BigDecimal meterHours) { this.meterHours = meterHours; }
    public void setLastServiceDate(LocalDate lastServiceDate) { this.lastServiceDate = lastServiceDate; }
    public void setNextServiceDueDate(LocalDate nextServiceDueDate) { this.nextServiceDueDate = nextServiceDueDate; }
    public void update(String name, UUID workCenterId, String serialNumber, String manufacturer, String model,
                       LocalDate installationDate, LocalDate warrantyExpiry, String notes) {
        this.name = name;
        this.workCenterId = workCenterId;
        this.serialNumber = serialNumber;
        this.manufacturer = manufacturer;
        this.model = model;
        this.installationDate = installationDate;
        this.warrantyExpiry = warrantyExpiry;
        this.notes = notes;
    }
}
