package si.spindl.maintenance;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "maintenance_schedules", uniqueConstraints = {
    @UniqueConstraint(name = "uk_maintenance_schedules_tenant_id", columnNames = {"tenant_id", "id"})
})
public class MaintenanceScheduleEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "asset_id", nullable = false) private UUID assetId;
    @Column(nullable = false, length = 160) private String title;
    @Column(name = "frequency_type", nullable = false, length = 20) private String frequencyType;
    @Column(name = "frequency_interval", nullable = false) private int frequencyInterval;
    @Column(name = "last_performed_at") private Instant lastPerformedAt;
    @Column(name = "next_due_date") private LocalDate nextDueDate;
    @Column(columnDefinition = "JSONB", nullable = false) private String checklist = "[]";
    @Column(nullable = false) private boolean active = true;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected MaintenanceScheduleEntity() {}

    public MaintenanceScheduleEntity(UUID tenantId, UUID assetId, String title, String frequencyType,
                                     int frequencyInterval, LocalDate nextDueDate, String checklist) {
        this.tenantId = tenantId;
        this.assetId = assetId;
        this.title = title;
        this.frequencyType = frequencyType;
        this.frequencyInterval = frequencyInterval;
        this.nextDueDate = nextDueDate;
        if (checklist != null) this.checklist = checklist;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getAssetId() { return assetId; }
    public String getTitle() { return title; }
    public String getFrequencyType() { return frequencyType; }
    public int getFrequencyInterval() { return frequencyInterval; }
    public Instant getLastPerformedAt() { return lastPerformedAt; }
    public LocalDate getNextDueDate() { return nextDueDate; }
    public String getChecklist() { return checklist; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }

    public void setActive(boolean active) { this.active = active; }
    public void recordExecution(Instant performedAt, LocalDate nextDue) {
        this.lastPerformedAt = performedAt;
        this.nextDueDate = nextDue;
    }
}
