package si.spindl.catalog;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "items", uniqueConstraints = {@UniqueConstraint(name = "uk_items_tenant_sku", columnNames = {"tenant_id", "sku"}),@UniqueConstraint(name="uk_items_tenant_id",columnNames={"tenant_id","id"})})
public class ItemEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(nullable = false, length = 64) private String sku;
    @Column(nullable = false, length = 180) private String name;
    @Column(nullable = false, length = 100) private String category;
    @Column(name = "on_hand", nullable = false) private int onHand;
    @Column(name = "reserved_quantity", nullable = false) private int reservedQuantity;
    @Column(name = "manufacturing_reserved_quantity", nullable = false) private int manufacturingReservedQuantity;
    @Column(name = "quality_hold_quantity", nullable = false) private int qualityHoldQuantity;
    @Column(name = "quality_inspection_required", nullable = false) private boolean qualityInspectionRequired;
    @Column(name = "low_stock_threshold", nullable = false) private int lowStockThreshold = 10;
    @Column(nullable = false, length = 24) private String unit;
    @Column(length=64) private String barcode;
    @Column(name="item_type",nullable=false,length=16) private String itemType="FINISHED";
    @Column(name = "unit_price", nullable = false, precision = 14, scale = 2) private BigDecimal unitPrice;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ItemEntity() {}
    public ItemEntity(UUID tenantId, String sku, String name, String category, int onHand, String unit, BigDecimal unitPrice, int lowStockThreshold) {
        this.tenantId = tenantId; this.sku = sku; this.name = name; this.category = category;
        this.onHand = onHand; this.unit = unit; this.unitPrice = unitPrice; this.lowStockThreshold = lowStockThreshold;
    }
    @PrePersist void onCreate() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
    public UUID getId() { return id; } public UUID getTenantId() { return tenantId; }
    public String getSku() { return sku; } public String getName() { return name; }
    public String getCategory() { return category; } public String getItemType(){return itemType;} public int getOnHand() { return onHand; }
    public String getUnit() { return unit; } public BigDecimal getUnitPrice() { return unitPrice; }
    public boolean isActive() { return active; }
    public int getReservedQuantity(){return reservedQuantity;}
    public int getLowStockThreshold(){return lowStockThreshold;}
    public int getAvailableQuantity(){return onHand-reservedQuantity-manufacturingReservedQuantity-qualityHoldQuantity;}
    public int getQualityHoldQuantity(){return qualityHoldQuantity;}
    public boolean isQualityInspectionRequired(){return qualityInspectionRequired;}
    public void setQualityInspectionRequired(boolean required){qualityInspectionRequired=required;}
    public void receiveStockForQuality(int quantity){if(quantity<=0)throw new IllegalArgumentException("Received quantity must be positive");onHand=Math.addExact(onHand,quantity);qualityHoldQuantity=Math.addExact(qualityHoldQuantity,quantity);}
    public void addExistingStockToQualityHold(int quantity){if(quantity<0||quantity>onHand-qualityHoldQuantity)throw new IllegalArgumentException("Invalid existing stock hold");qualityHoldQuantity=Math.addExact(qualityHoldQuantity,quantity);}
    public void releaseQualityHold(int quantity){if(quantity<=0||quantity>qualityHoldQuantity)throw new IllegalArgumentException("Quality release exceeds held quantity");qualityHoldQuantity-=quantity;}
    public void rejectQualityHold(int quantity){if(quantity<=0||quantity>qualityHoldQuantity||quantity>onHand)throw new IllegalArgumentException("Quality rejection exceeds held quantity");qualityHoldQuantity-=quantity;onHand-=quantity;}
    public void reserveStock(int quantity){if(quantity<=0||quantity>getAvailableQuantity())throw new IllegalArgumentException("Requested quantity exceeds available stock");reservedQuantity=Math.addExact(reservedQuantity,quantity);}
    public void shipReservedStock(int quantity){if(quantity<=0||quantity>reservedQuantity||quantity>onHand)throw new IllegalArgumentException("Shipment quantity exceeds reserved stock");onHand-=quantity;reservedQuantity-=quantity;}
    public void receiveStock(int quantity) {
        if (quantity <= 0) throw new IllegalArgumentException("Received quantity must be positive");
        this.onHand = Math.addExact(this.onHand, quantity);
    }
    public void adjustStock(int quantityDelta) {
        if (quantityDelta == 0) throw new IllegalArgumentException("Adjustment quantity cannot be zero");
        int adjusted = Math.addExact(onHand, quantityDelta);
        if (adjusted < reservedQuantity + manufacturingReservedQuantity + qualityHoldQuantity) throw new IllegalArgumentException("Adjustment cannot reduce stock below reserved or quality-held quantities");
        onHand = adjusted;
    }
    public void adjustStockInExternalWarehouse(int quantityDelta) {
        if (quantityDelta == 0) throw new IllegalArgumentException("Adjustment quantity cannot be zero");
        onHand = Math.addExact(onHand, quantityDelta);
    }
    public int getManufacturingReservedQuantity(){return manufacturingReservedQuantity;}
    public void reserveForManufacturing(int quantity){if(quantity<=0||quantity>getAvailableQuantity())throw new IllegalArgumentException("Requested quantity exceeds available stock");manufacturingReservedQuantity=Math.addExact(manufacturingReservedQuantity,quantity);}
    public void issueForManufacturing(int quantity){if(quantity<=0||quantity>manufacturingReservedQuantity||quantity>onHand)throw new IllegalArgumentException("Issue quantity exceeds manufacturing reservation");manufacturingReservedQuantity-=quantity;onHand-=quantity;}
    public void releaseManufacturingReservation(int quantity){if(quantity<0||quantity>manufacturingReservedQuantity)throw new IllegalArgumentException("Release quantity exceeds manufacturing reservation");manufacturingReservedQuantity-=quantity;}
    public void update(String name, String category, String unit, BigDecimal unitPrice, boolean active) {
        this.name = name; this.category = category; this.unit = unit; this.unitPrice = unitPrice; this.active = active;
    }
    public void updateType(String itemType){this.itemType=itemType;}
    public void setBarcode(String barcode){this.barcode=barcode==null||barcode.isBlank()?null:barcode.trim().toUpperCase(java.util.Locale.ROOT);}
    public String getBarcode(){return barcode;}
    public void setLowStockThreshold(int threshold){if(threshold<0)throw new IllegalArgumentException("Low stock threshold cannot be negative");this.lowStockThreshold=threshold;}
}
