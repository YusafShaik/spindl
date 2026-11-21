package si.spindl.mrp;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class MrpDtos {
    private MrpDtos() {}

    public record MrpRunView(
            UUID id,
            String runNumber,
            String status,
            int planningHorizonWeeks,
            int totalRecommendations,
            BigDecimal totalPlannedSpend,
            int totalShortageUnits,
            String notes,
            String createdByName,
            Instant createdAt
    ) {
        public static MrpRunView from(MrpRunEntity r) {
            return new MrpRunView(
                    r.getId(),
                    r.getRunNumber(),
                    r.getStatus(),
                    r.getPlanningHorizonWeeks(),
                    r.getTotalRecommendations(),
                    r.getTotalPlannedSpend(),
                    r.getTotalShortageUnits(),
                    r.getNotes(),
                    r.getCreatedBy() != null ? r.getCreatedBy().getDisplayName() : "System Automation",
                    r.getCreatedAt()
            );
        }
    }

    public record PlannedOrderView(
            UUID id,
            UUID runId,
            String runNumber,
            UUID itemId,
            String sku,
            String itemName,
            String unit,
            String itemType,
            String actionType,
            UUID bomId,
            String bomRevision,
            UUID supplierId,
            String supplierName,
            int recommendedQuantity,
            LocalDate recommendedOrderDate,
            LocalDate requiredByDate,
            int leadTimeDays,
            BigDecimal estimatedUnitCost,
            BigDecimal estimatedTotalCost,
            String urgency,
            String demandSourceType,
            String demandSourceRef,
            String status,
            UUID convertedEntityId,
            String convertedOrderNumber,
            Instant convertedAt,
            Instant createdAt
    ) {
        public static PlannedOrderView from(MrpPlannedOrderEntity o) {
            return new PlannedOrderView(
                    o.getId(),
                    o.getMrpRun().getId(),
                    o.getMrpRun().getRunNumber(),
                    o.getItem().getId(),
                    o.getItem().getSku(),
                    o.getItem().getName(),
                    o.getItem().getUnit(),
                    o.getItem().getItemType(),
                    o.getActionType(),
                    o.getBom() != null ? o.getBom().getId() : null,
                    o.getBom() != null ? o.getBom().getRevision() : null,
                    o.getSuggestedSupplier() != null ? o.getSuggestedSupplier().getId() : null,
                    o.getSuggestedSupplier() != null ? o.getSuggestedSupplier().getName() : null,
                    o.getRecommendedQuantity(),
                    o.getRecommendedOrderDate(),
                    o.getRequiredByDate(),
                    o.getLeadTimeDays(),
                    o.getEstimatedUnitCost(),
                    o.getEstimatedTotalCost(),
                    o.getUrgency(),
                    o.getDemandSourceType(),
                    o.getDemandSourceRef(),
                    o.getStatus(),
                    o.getConvertedEntityId(),
                    o.getConvertedOrderNumber(),
                    o.getConvertedAt(),
                    o.getCreatedAt()
            );
        }
    }

    public record MrpMetricsView(
            long totalRuns,
            long openShortagesCount,
            long plannedPurchasesCount,
            long plannedWorkOrdersCount,
            BigDecimal totalProjectedSpend,
            long convertedOrdersCount
    ) {}

    public record CalculateMrpRequest(
            @Min(1) @Max(26) Integer planningHorizonWeeks,
            Boolean includeSafetyStock,
            String notes
    ) {}

    public record BatchConvertRequest(
            @NotEmpty List<UUID> orderIds
    ) {}

    public record BatchConvertResponse(
            int convertedCount,
            int failedCount,
            List<String> createdOrderNumbers,
            List<String> messages
    ) {}
}
