package si.spindl.mrp;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.identity.AppUserEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "mrp_runs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mrp_runs_number", columnNames = {"tenant_id", "run_number"})
})
public class MrpRunEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "run_number", nullable = false, length = 64)
    private String runNumber;

    @Column(nullable = false, length = 24)
    private String status = "COMPLETED"; // 'COMPLETED', 'APPLIED', 'ARCHIVED'

    @Column(name = "planning_horizon_weeks", nullable = false)
    private int planningHorizonWeeks = 4;

    @Column(name = "total_recommendations", nullable = false)
    private int totalRecommendations = 0;

    @Column(name = "total_planned_spend", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalPlannedSpend = BigDecimal.ZERO;

    @Column(name = "total_shortage_units", nullable = false)
    private int totalShortageUnits = 0;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUserEntity createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "mrpRun", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MrpPlannedOrderEntity> plannedOrders = new ArrayList<>();

    protected MrpRunEntity() {}

    public MrpRunEntity(UUID tenantId, String runNumber, int planningHorizonWeeks, String notes, AppUserEntity createdBy) {
        this.tenantId = tenantId;
        this.runNumber = runNumber;
        this.planningHorizonWeeks = planningHorizonWeeks;
        this.notes = notes;
        this.createdBy = createdBy;
        this.status = "COMPLETED";
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getRunNumber() { return runNumber; }
    public String getStatus() { return status; }
    public int getPlanningHorizonWeeks() { return planningHorizonWeeks; }
    public int getTotalRecommendations() { return totalRecommendations; }
    public BigDecimal getTotalPlannedSpend() { return totalPlannedSpend; }
    public int getTotalShortageUnits() { return totalShortageUnits; }
    public String getNotes() { return notes; }
    public AppUserEntity getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public List<MrpPlannedOrderEntity> getPlannedOrders() { return plannedOrders; }

    public void addPlannedOrder(MrpPlannedOrderEntity order) {
        plannedOrders.add(order);
        order.setMrpRun(this);
        recalculateTotals();
    }

    public void recalculateTotals() {
        this.totalRecommendations = plannedOrders.size();
        this.totalShortageUnits = plannedOrders.stream().mapToInt(MrpPlannedOrderEntity::getRecommendedQuantity).sum();
        this.totalPlannedSpend = plannedOrders.stream()
                .map(MrpPlannedOrderEntity::getEstimatedTotalCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void markApplied() {
        this.status = "APPLIED";
    }

    public void markArchived() {
        this.status = "ARCHIVED";
    }
}
