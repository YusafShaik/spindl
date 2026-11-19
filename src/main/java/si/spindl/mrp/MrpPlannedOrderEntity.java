package si.spindl.mrp;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.ItemEntity;
import si.spindl.manufacturing.BomEntity;
import si.spindl.purchasing.SupplierEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "mrp_planned_orders")
public class MrpPlannedOrderEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mrp_run_id", nullable = false)
    private MrpRunEntity mrpRun;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ItemEntity item;

    @Column(name = "action_type", nullable = false, length = 24)
    private String actionType; // 'PURCHASE_ORDER', 'WORK_ORDER'

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bom_id")
    private BomEntity bom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suggested_supplier_id")
    private SupplierEntity suggestedSupplier;

    @Column(name = "recommended_quantity", nullable = false)
    private int recommendedQuantity;

    @Column(name = "recommended_order_date", nullable = false)
    private LocalDate recommendedOrderDate;

    @Column(name = "required_by_date", nullable = false)
    private LocalDate requiredByDate;

    @Column(name = "lead_time_days", nullable = false)
    private int leadTimeDays = 0;

    @Column(name = "estimated_unit_cost", nullable = false, precision = 14, scale = 2)
    private BigDecimal estimatedUnitCost = BigDecimal.ZERO;

    @Column(name = "estimated_total_cost", nullable = false, precision = 14, scale = 2)
    private BigDecimal estimatedTotalCost = BigDecimal.ZERO;

    @Column(nullable = false, length = 24)
    private String urgency = "MEDIUM"; // 'CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL'

    @Column(name = "demand_source_type", nullable = false, length = 32)
    private String demandSourceType; // 'SALES_ORDER', 'WORK_ORDER_COMPONENT', 'SAFETY_STOCK', 'MULTI_LEVEL_BOM'

    @Column(name = "demand_source_ref", length = 120)
    private String demandSourceRef;

    @Column(nullable = false, length = 24)
    private String status = "PENDING"; // 'PENDING', 'CONVERTED', 'DISMISSED'

    @Column(name = "converted_entity_id")
    private UUID convertedEntityId;

    @Column(name = "converted_order_number", length = 64)
    private String convertedOrderNumber;

    @Column(name = "converted_at")
    private Instant convertedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected MrpPlannedOrderEntity() {}

    public MrpPlannedOrderEntity(UUID tenantId, MrpRunEntity mrpRun, ItemEntity item, String actionType,
                                 BomEntity bom, SupplierEntity suggestedSupplier, int recommendedQuantity,
                                 LocalDate recommendedOrderDate, LocalDate requiredByDate, int leadTimeDays,
                                 BigDecimal estimatedUnitCost, String urgency, String demandSourceType,
                                 String demandSourceRef) {
        this.tenantId = tenantId;
        this.mrpRun = mrpRun;
        this.item = item;
        this.actionType = actionType;
        this.bom = bom;
        this.suggestedSupplier = suggestedSupplier;
        this.recommendedQuantity = recommendedQuantity;
        this.recommendedOrderDate = recommendedOrderDate;
        this.requiredByDate = requiredByDate;
        this.leadTimeDays = leadTimeDays;
        this.estimatedUnitCost = estimatedUnitCost != null ? estimatedUnitCost : BigDecimal.ZERO;
        this.estimatedTotalCost = this.estimatedUnitCost.multiply(BigDecimal.valueOf(recommendedQuantity));
        this.urgency = urgency != null ? urgency : "MEDIUM";
        this.demandSourceType = demandSourceType;
        this.demandSourceRef = demandSourceRef;
        this.status = "PENDING";
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public MrpRunEntity getMrpRun() { return mrpRun; }
    public void setMrpRun(MrpRunEntity mrpRun) { this.mrpRun = mrpRun; }
    public ItemEntity getItem() { return item; }
    public String getActionType() { return actionType; }
    public BomEntity getBom() { return bom; }
    public SupplierEntity getSuggestedSupplier() { return suggestedSupplier; }
    public int getRecommendedQuantity() { return recommendedQuantity; }
    public LocalDate getRecommendedOrderDate() { return recommendedOrderDate; }
    public LocalDate getRequiredByDate() { return requiredByDate; }
    public int getLeadTimeDays() { return leadTimeDays; }
    public BigDecimal getEstimatedUnitCost() { return estimatedUnitCost; }
    public BigDecimal getEstimatedTotalCost() { return estimatedTotalCost; }
    public String getUrgency() { return urgency; }
    public String getDemandSourceType() { return demandSourceType; }
    public String getDemandSourceRef() { return demandSourceRef; }
    public String getStatus() { return status; }
    public UUID getConvertedEntityId() { return convertedEntityId; }
    public String getConvertedOrderNumber() { return convertedOrderNumber; }
    public Instant getConvertedAt() { return convertedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void markConverted(UUID entityId, String orderNumber) {
        this.status = "CONVERTED";
        this.convertedEntityId = entityId;
        this.convertedOrderNumber = orderNumber;
        this.convertedAt = Instant.now();
    }

    public void markDismissed() {
        this.status = "DISMISSED";
    }
}
