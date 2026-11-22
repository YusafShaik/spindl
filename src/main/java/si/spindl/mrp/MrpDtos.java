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
    ) {}

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
    ) {}

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
