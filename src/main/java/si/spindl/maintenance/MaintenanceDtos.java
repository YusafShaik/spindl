package si.spindl.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class MaintenanceDtos {

    public record AssetRequest(
        @NotBlank @Size(max = 40) String code,
        @NotBlank @Size(max = 120) String name,
        UUID workCenterId,
        @Size(max = 100) String serialNumber,
        @Size(max = 100) String manufacturer,
        @Size(max = 100) String model,
        String status,
        BigDecimal meterHours,
        LocalDate installationDate,
        LocalDate warrantyExpiry,
        LocalDate nextServiceDueDate,
        String notes
    ) {}

    public record AssetView(
        UUID id,
        String code,
        String name,
        UUID workCenterId,
        String workCenterCode,
        String workCenterName,
        String serialNumber,
        String manufacturer,
        String model,
        String status,
        BigDecimal meterHours,
        BigDecimal totalMaintenanceCost,
        LocalDate installationDate,
        LocalDate warrantyExpiry,
        LocalDate lastServiceDate,
        LocalDate nextServiceDueDate,
        String notes,
        Instant createdAt
    ) {}

    public record ScheduleRequest(
        @NotNull UUID assetId,
        @NotBlank @Size(max = 160) String title,
        @NotBlank String frequencyType,
        int frequencyInterval,
        LocalDate nextDueDate,
        String checklist
    ) {}

    public record ScheduleView(
        UUID id,
        UUID assetId,
        String assetCode,
        String assetName,
        String title,
        String frequencyType,
        int frequencyInterval,
        Instant lastPerformedAt,
        LocalDate nextDueDate,
        String checklist,
        boolean active,
        Instant createdAt
    ) {}

    public record WorkOrderRequest(
        @NotNull UUID assetId,
        UUID scheduleId,
        @NotBlank String type, // PREVENTIVE, BREAKDOWN
        @NotBlank String priority, // LOW, MEDIUM, HIGH, EMERGENCY
        String technicianType, // INTERNAL, EXTERNAL
        UUID assignedTechnicianUserId,
        String externalContractorName,
        String failureSymptom,
        LocalDate scheduledDate
    ) {}

    public record PartConsumptionItem(
        UUID itemId, // nullable for external parts
        UUID warehouseId,
        @NotNull BigDecimal quantity,
        BigDecimal unitCost,
        String partSource, // INTERNAL, EXTERNAL
        String externalPartName,
        String externalPartNumber,
        String supplierName,
        String invoiceReference
    ) {}

    public record CompleteWorkOrderRequest(
        String rootCause,
        @NotBlank String resolutionNotes,
        int downtimeMinutes,
        String technicianType, // INTERNAL or EXTERNAL
        UUID assignedTechnicianUserId,
        String externalContractorName,
        String externalInvoiceRef,
        BigDecimal laborCost,
        List<PartConsumptionItem> partsConsumed
    ) {}

    public record PartConsumedView(
        UUID id,
        String partSource, // INTERNAL or EXTERNAL
        UUID itemId,
        String sku,
        String itemName,
        UUID warehouseId,
        String warehouseName,
        String externalPartName,
        String externalPartNumber,
        String supplierName,
        String invoiceReference,
        BigDecimal quantity,
        BigDecimal unitCost,
        BigDecimal totalCost,
        Instant createdAt
    ) {}

    public record WorkOrderView(
        UUID id,
        String orderNumber,
        UUID assetId,
        String assetCode,
        String assetName,
        UUID workCenterId,
        String workCenterName,
        UUID scheduleId,
        String scheduleTitle,
        String type,
        String priority,
        String status,
        String technicianType,
        UUID assignedTechnicianUserId,
        String assignedTechnicianName,
        String externalContractorName,
        String externalInvoiceRef,
        BigDecimal laborCost,
        BigDecimal partsCost,
        BigDecimal totalCost,
        String failureSymptom,
        String rootCause,
        String resolutionNotes,
        int downtimeMinutes,
        LocalDate scheduledDate,
        Instant startedAt,
        Instant completedAt,
        Instant createdAt,
        List<PartConsumedView> partsConsumed
    ) {}

    public record MaintenanceMetricsView(
        long totalAssets,
        long operationalAssets,
        long underMaintenanceAssets,
        long openWorkOrders,
        long criticalBreakdowns,
        double availabilityPercent,
        double mtbfHours,
        double mttrMinutes,
        long totalPartsConsumedCount,
        BigDecimal totalPartsConsumedValue,
        BigDecimal totalMaintenanceExpenditure
    ) {}
}
