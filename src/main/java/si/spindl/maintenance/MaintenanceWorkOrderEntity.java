package si.spindl.maintenance;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "maintenance_work_orders", uniqueConstraints = {
    @UniqueConstraint(name = "uk_maintenance_wo_tenant_number", columnNames = {"tenant_id", "order_number"}),
    @UniqueConstraint(name = "uk_maintenance_wo_tenant_id", columnNames = {"tenant_id", "id"})
})
public class MaintenanceWorkOrderEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "order_number", nullable = false, length = 60) private String orderNumber;
    @Column(name = "asset_id", nullable = false) private UUID assetId;
    @Column(name = "schedule_id") private UUID scheduleId;
    @Column(nullable = false, length = 20) private String type; // PREVENTIVE, BREAKDOWN
    @Column(nullable = false, length = 20) private String priority; // LOW, MEDIUM, HIGH, EMERGENCY
    @Column(nullable = false, length = 20) private String status = "OPEN"; // OPEN, IN_PROGRESS, COMPLETED, CANCELLED
    @Column(name = "technician_type", nullable = false, length = 20) private String technicianType = "INTERNAL"; // INTERNAL, EXTERNAL
    @Column(name = "assigned_technician_user_id") private UUID assignedTechnicianUserId;
    @Column(name = "external_contractor_name", length = 160) private String externalContractorName;
    @Column(name = "external_invoice_ref", length = 100) private String externalInvoiceRef;
    @Column(name = "labor_cost", nullable = false, precision = 12, scale = 2) private java.math.BigDecimal laborCost = java.math.BigDecimal.ZERO;
    @Column(name = "parts_cost", nullable = false, precision = 12, scale = 2) private java.math.BigDecimal partsCost = java.math.BigDecimal.ZERO;
    @Column(name = "total_cost", nullable = false, precision = 12, scale = 2) private java.math.BigDecimal totalCost = java.math.BigDecimal.ZERO;
    @Column(name = "failure_symptom", columnDefinition = "TEXT") private String failureSymptom;
    @Column(name = "root_cause", columnDefinition = "TEXT") private String rootCause;
    @Column(name = "resolution_notes", columnDefinition = "TEXT") private String resolutionNotes;
    @Column(name = "downtime_minutes", nullable = false) private int downtimeMinutes = 0;
    @Column(name = "scheduled_date") private LocalDate scheduledDate;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected MaintenanceWorkOrderEntity() {}

    public MaintenanceWorkOrderEntity(UUID tenantId, String orderNumber, UUID assetId, UUID scheduleId,
                                      String type, String priority, UUID assignedTechnicianUserId,
                                      String failureSymptom, LocalDate scheduledDate) {
        this.tenantId = tenantId;
        this.orderNumber = orderNumber;
        this.assetId = assetId;
        this.scheduleId = scheduleId;
        this.type = type;
        this.priority = priority;
        this.status = "OPEN";
        this.assignedTechnicianUserId = assignedTechnicianUserId;
        this.failureSymptom = failureSymptom;
        this.scheduledDate = scheduledDate;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getOrderNumber() { return orderNumber; }
    public UUID getAssetId() { return assetId; }
    public UUID getScheduleId() { return scheduleId; }
    public String getType() { return type; }
    public String getPriority() { return priority; }
    public String getStatus() { return status; }
    public String getTechnicianType() { return technicianType != null ? technicianType : "INTERNAL"; }
    public void setTechnicianType(String technicianType) { this.technicianType = technicianType; }
    public UUID getAssignedTechnicianUserId() { return assignedTechnicianUserId; }
    public String getExternalContractorName() { return externalContractorName; }
    public void setExternalContractorName(String externalContractorName) { this.externalContractorName = externalContractorName; }
    public String getExternalInvoiceRef() { return externalInvoiceRef; }
    public void setExternalInvoiceRef(String externalInvoiceRef) { this.externalInvoiceRef = externalInvoiceRef; }
    public java.math.BigDecimal getLaborCost() { return laborCost != null ? laborCost : java.math.BigDecimal.ZERO; }
    public void setLaborCost(java.math.BigDecimal laborCost) { this.laborCost = laborCost; }
    public java.math.BigDecimal getPartsCost() { return partsCost != null ? partsCost : java.math.BigDecimal.ZERO; }
    public void setPartsCost(java.math.BigDecimal partsCost) { this.partsCost = partsCost; }
    public java.math.BigDecimal getTotalCost() { return totalCost != null ? totalCost : java.math.BigDecimal.ZERO; }
    public void setTotalCost(java.math.BigDecimal totalCost) { this.totalCost = totalCost; }
    public String getFailureSymptom() { return failureSymptom; }
    public String getRootCause() { return rootCause; }
    public String getResolutionNotes() { return resolutionNotes; }
    public int getDowntimeMinutes() { return downtimeMinutes; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void start() {
        this.status = "IN_PROGRESS";
        this.startedAt = Instant.now();
    }

    public void assign(UUID technicianUserId) {
        this.assignedTechnicianUserId = technicianUserId;
    }

    public void complete(String rootCause, String resolutionNotes, int downtimeMinutes,
                         String technicianType, String externalContractorName, String externalInvoiceRef,
                         java.math.BigDecimal laborCost, java.math.BigDecimal partsCost) {
        this.status = "COMPLETED";
        this.rootCause = rootCause;
        this.resolutionNotes = resolutionNotes;
        this.downtimeMinutes = downtimeMinutes;
        if (technicianType != null && !technicianType.isBlank()) this.technicianType = technicianType;
        if (externalContractorName != null) this.externalContractorName = externalContractorName;
        if (externalInvoiceRef != null) this.externalInvoiceRef = externalInvoiceRef;
        if (laborCost != null) this.laborCost = laborCost;
        if (partsCost != null) this.partsCost = partsCost;
        this.totalCost = (this.laborCost != null ? this.laborCost : java.math.BigDecimal.ZERO)
            .add(this.partsCost != null ? this.partsCost : java.math.BigDecimal.ZERO);
        this.completedAt = Instant.now();
    }

    public void complete(String rootCause, String resolutionNotes, int downtimeMinutes) {
        complete(rootCause, resolutionNotes, downtimeMinutes, null, null, null, null, null);
    }

    public void cancel(String notes) {
        this.status = "CANCELLED";
        this.resolutionNotes = notes;
    }
}
