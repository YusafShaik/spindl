package si.spindl.logistics;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_challans", uniqueConstraints = {
    @UniqueConstraint(name = "uk_delivery_challans_tenant_number", columnNames = {"tenant_id", "challan_number"})
})
public class DeliveryChallanEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "challan_number", nullable = false, length = 64) private String challanNumber;
    @Column(name = "sales_order_id") private UUID salesOrderId;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "warehouse_id") private UUID warehouseId;
    @Column(nullable = false, length = 32) private String status = "DRAFT"; // DRAFT, PACKED, IN_TRANSIT, DELIVERED, CANCELLED
    @Column(name = "carrier_name", length = 120) private String carrierName;
    @Column(name = "carrier_mode", nullable = false, length = 32) private String carrierMode = "ROAD"; // ROAD, AIR, RAIL, SEA, SELF_PICKUP
    @Column(name = "tracking_number", length = 120) private String trackingNumber;
    @Column(name = "vehicle_number", length = 64) private String vehicleNumber;
    @Column(name = "driver_name", length = 120) private String driverName;
    @Column(name = "driver_phone", length = 32) private String driverPhone;
    @Column(name = "eway_bill_number", length = 64) private String ewayBillNumber;
    @Column(name = "eway_bill_valid_till") private Instant ewayBillValidTill;
    @Column(name = "shipping_address", columnDefinition = "TEXT") private String shippingAddress;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "total_packages", nullable = false) private int totalPackages = 1;
    @Column(name = "total_weight_kg", nullable = false, precision = 10, scale = 2) private BigDecimal totalWeightKg = BigDecimal.ZERO;
    @Column(name = "dispatched_at") private Instant dispatchedAt;
    @Column(name = "delivered_at") private Instant deliveredAt;
    @Column(name = "pod_recipient_name", length = 120) private String podRecipientName;
    @Column(name = "pod_notes", columnDefinition = "TEXT") private String podNotes;
    @Column(name = "created_by") private UUID createdBy;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected DeliveryChallanEntity() {}

    public DeliveryChallanEntity(UUID tenantId, String challanNumber, UUID salesOrderId, UUID customerId,
                                 UUID warehouseId, String status, String carrierName, String carrierMode,
                                 String trackingNumber, String vehicleNumber, String driverName, String driverPhone,
                                 String ewayBillNumber, Instant ewayBillValidTill, String shippingAddress,
                                 String notes, int totalPackages, BigDecimal totalWeightKg, UUID createdBy) {
        this.tenantId = tenantId;
        this.challanNumber = challanNumber;
        this.salesOrderId = salesOrderId;
        this.customerId = customerId;
        this.warehouseId = warehouseId;
        this.status = status != null ? status : "DRAFT";
        this.carrierName = carrierName;
        this.carrierMode = carrierMode != null ? carrierMode : "ROAD";
        this.trackingNumber = trackingNumber;
        this.vehicleNumber = vehicleNumber;
        this.driverName = driverName;
        this.driverPhone = driverPhone;
        this.ewayBillNumber = ewayBillNumber;
        this.ewayBillValidTill = ewayBillValidTill;
        this.shippingAddress = shippingAddress;
        this.notes = notes;
        this.totalPackages = Math.max(1, totalPackages);
        this.totalWeightKg = totalWeightKg != null ? totalWeightKg : BigDecimal.ZERO;
        this.createdBy = createdBy;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getChallanNumber() { return challanNumber; }
    public UUID getSalesOrderId() { return salesOrderId; }
    public UUID getCustomerId() { return customerId; }
    public UUID getWarehouseId() { return warehouseId; }
    public String getStatus() { return status; }
    public String getCarrierName() { return carrierName; }
    public String getCarrierMode() { return carrierMode; }
    public String getTrackingNumber() { return trackingNumber; }
    public String getVehicleNumber() { return vehicleNumber; }
    public String getDriverName() { return driverName; }
    public String getDriverPhone() { return driverPhone; }
    public String getEwayBillNumber() { return ewayBillNumber; }
    public Instant getEwayBillValidTill() { return ewayBillValidTill; }
    public String getShippingAddress() { return shippingAddress; }
    public String getNotes() { return notes; }
    public int getTotalPackages() { return totalPackages; }
    public BigDecimal getTotalWeightKg() { return totalWeightKg; }
    public Instant getDispatchedAt() { return dispatchedAt; }
    public Instant getDeliveredAt() { return deliveredAt; }
    public String getPodRecipientName() { return podRecipientName; }
    public String getPodNotes() { return podNotes; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void updateTracking(String carrierName, String carrierMode, String trackingNumber,
                               String vehicleNumber, String driverName, String driverPhone,
                               String ewayBillNumber, Instant ewayBillValidTill) {
        if (carrierName != null) this.carrierName = carrierName;
        if (carrierMode != null) this.carrierMode = carrierMode;
        if (trackingNumber != null) this.trackingNumber = trackingNumber;
        if (vehicleNumber != null) this.vehicleNumber = vehicleNumber;
        if (driverName != null) this.driverName = driverName;
        if (driverPhone != null) this.driverPhone = driverPhone;
        if (ewayBillNumber != null) this.ewayBillNumber = ewayBillNumber;
        if (ewayBillValidTill != null) this.ewayBillValidTill = ewayBillValidTill;
    }

    public void dispatch() {
        this.status = "IN_TRANSIT";
        if (this.dispatchedAt == null) {
            this.dispatchedAt = Instant.now();
        }
    }

    public void recordPod(String recipientName, String notes, Instant deliveryTime) {
        this.status = "DELIVERED";
        this.podRecipientName = recipientName;
        this.podNotes = notes;
        this.deliveredAt = deliveryTime != null ? deliveryTime : Instant.now();
    }

    public void cancel() {
        this.status = "CANCELLED";
    }

    public void setTotals(int totalPackages, BigDecimal totalWeightKg) {
        this.totalPackages = totalPackages;
        this.totalWeightKg = totalWeightKg;
    }
}
