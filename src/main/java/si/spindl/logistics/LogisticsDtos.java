package si.spindl.logistics;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class LogisticsDtos {

    public record ChallanSummaryView(
        UUID id,
        String challanNumber,
        UUID salesOrderId,
        String orderNumber,
        UUID customerId,
        String customerName,
        String customerCity,
        UUID warehouseId,
        String warehouseCode,
        String status,
        String carrierName,
        String carrierMode,
        String trackingNumber,
        String vehicleNumber,
        String driverName,
        String driverPhone,
        String ewayBillNumber,
        Instant ewayBillValidTill,
        int totalPackages,
        BigDecimal totalWeightKg,
        BigDecimal totalValue,
        Instant dispatchedAt,
        Instant deliveredAt,
        Instant createdAt
    ) {}

    public record ChallanDetailView(
        ChallanSummaryView summary,
        String shippingAddress,
        String notes,
        String podRecipientName,
        String podNotes,
        List<PackageView> packages,
        List<ChallanItemView> items
    ) {}

    public record PackageView(
        UUID id,
        String packageNumber,
        String packageType,
        BigDecimal weightKg,
        String dimensionsCm,
        String contentsSummary
    ) {}

    public record ChallanItemView(
        UUID id,
        UUID packageId,
        String packageNumber,
        UUID itemId,
        String sku,
        String itemName,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        String hsnCode
    ) {}

    public record CreatePackageItem(
        String packageNumber,
        String packageType,
        BigDecimal weightKg,
        String dimensionsCm,
        String contentsSummary
    ) {}

    public record CreateChallanItem(
        Integer packageIndex,
        UUID itemId,
        int quantity,
        BigDecimal unitPrice,
        String hsnCode
    ) {}

    public record CreateChallanRequest(
        UUID salesOrderId,
        UUID customerId,
        UUID warehouseId,
        String carrierName,
        String carrierMode,
        String trackingNumber,
        String vehicleNumber,
        String driverName,
        String driverPhone,
        String ewayBillNumber,
        Instant ewayBillValidTill,
        String shippingAddress,
        String notes,
        List<CreatePackageItem> packages,
        List<CreateChallanItem> items
    ) {}

    public record UpdateTrackingRequest(
        String carrierName,
        String carrierMode,
        String trackingNumber,
        String vehicleNumber,
        String driverName,
        String driverPhone,
        String ewayBillNumber,
        Instant ewayBillValidTill
    ) {}

    public record RecordPodRequest(
        String recipientName,
        String podNotes,
        Instant deliveryTime
    ) {}

    public record LogisticsMetricsView(
        long activeInTransit,
        long readyForPickup,
        long deliveredTotal,
        BigDecimal totalWeightKg,
        BigDecimal totalDispatchedValue,
        double onTimeSlaPercent
    ) {}
}
