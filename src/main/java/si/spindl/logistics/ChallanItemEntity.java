package si.spindl.logistics;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "challan_items")
public class ChallanItemEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "challan_id", nullable = false) private UUID challanId;
    @Column(name = "package_id") private UUID packageId;
    @Column(name = "item_id", nullable = false) private UUID itemId;
    @Column(nullable = false) private int quantity;
    @Column(name = "unit_price", nullable = false, precision = 14, scale = 2) private BigDecimal unitPrice = BigDecimal.ZERO;
    @Column(name = "hsn_code", length = 32) private String hsnCode;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ChallanItemEntity() {}

    public ChallanItemEntity(UUID tenantId, UUID challanId, UUID packageId, UUID itemId,
                             int quantity, BigDecimal unitPrice, String hsnCode) {
        this.tenantId = tenantId;
        this.challanId = challanId;
        this.packageId = packageId;
        this.itemId = itemId;
        this.quantity = quantity;
        this.unitPrice = unitPrice != null ? unitPrice : BigDecimal.ZERO;
        this.hsnCode = hsnCode;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getChallanId() { return challanId; }
    public UUID getPackageId() { return packageId; }
    public UUID getItemId() { return itemId; }
    public int getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public String getHsnCode() { return hsnCode; }
    public Instant getCreatedAt() { return createdAt; }

    public BigDecimal getLineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
