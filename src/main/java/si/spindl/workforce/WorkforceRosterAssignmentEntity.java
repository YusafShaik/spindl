package si.spindl.workforce;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.identity.AppUserEntity;
import si.spindl.manufacturing.WorkCenterEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "workforce_roster_assignments")
public class WorkforceRosterAssignmentEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private WorkforceShiftEntity shift;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUserEntity user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "work_center_id")
    private WorkCenterEntity workCenter;

    @Column(name = "roster_date", nullable = false)
    private LocalDate rosterDate = LocalDate.now();

    @Column(name = "planned_hours", nullable = false, precision = 4, scale = 2)
    private BigDecimal plannedHours = BigDecimal.valueOf(8.00);

    @Column(name = "attendance_status", nullable = false, length = 24)
    private String attendanceStatus = "SCHEDULED"; // SCHEDULED, PRESENT, LATE, ABSENT, ON_LEAVE

    @Column(name = "clock_in_time")
    private Instant clockInTime;

    @Column(name = "clock_out_time")
    private Instant clockOutTime;

    @Column(name = "actual_hours", precision = 4, scale = 2)
    private BigDecimal actualHours;

    @Column(name = "notes", length = 255)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public WorkforceRosterAssignmentEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public WorkforceShiftEntity getShift() { return shift; }
    public void setShift(WorkforceShiftEntity shift) { this.shift = shift; }

    public AppUserEntity getUser() { return user; }
    public void setUser(AppUserEntity user) { this.user = user; }

    public WorkCenterEntity getWorkCenter() { return workCenter; }
    public void setWorkCenter(WorkCenterEntity workCenter) { this.workCenter = workCenter; }

    public LocalDate getRosterDate() { return rosterDate; }
    public void setRosterDate(LocalDate rosterDate) { this.rosterDate = rosterDate; }

    public BigDecimal getPlannedHours() { return plannedHours; }
    public void setPlannedHours(BigDecimal plannedHours) { this.plannedHours = plannedHours; }

    public String getAttendanceStatus() { return attendanceStatus; }
    public void setAttendanceStatus(String attendanceStatus) { this.attendanceStatus = attendanceStatus; }

    public Instant getClockInTime() { return clockInTime; }
    public void setClockInTime(Instant clockInTime) { this.clockInTime = clockInTime; }

    public Instant getClockOutTime() { return clockOutTime; }
    public void setClockOutTime(Instant clockOutTime) { this.clockOutTime = clockOutTime; }

    public BigDecimal getActualHours() { return actualHours; }
    public void setActualHours(BigDecimal actualHours) { this.actualHours = actualHours; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
