package si.spindl.logistics;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "challan_packages")
public class ChallanPackageEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "challan_id", nullable = false) private UUID challanId;
    @Column(name = "package_number", nullable = false, length = 32) private String packageNumber;
    @Column(name = "package_type", nullable = false, length = 32) private String packageType = "BOX"; // BOX, PALLET, CRATE, BAG, DRUM, CONTAINER
    @Column(name = "weight_kg", nullable = false, precision = 10, scale = 2) private BigDecimal weightKg = BigDecimal.ZERO;
    @Column(name = "dimensions_cm", length = 64) private String dimensionsCm;
    @Column(name = "contents_summary", columnDefinition = "TEXT") private String contentsSummary;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ChallanPackageEntity() {}

    public ChallanPackageEntity(UUID tenantId, UUID challanId, String packageNumber, String packageType,
                                BigDecimal weightKg, String dimensionsCm, String contentsSummary) {
        this.tenantId = tenantId;
        this.challanId = challanId;
        this.packageNumber = packageNumber;
        this.packageType = packageType != null ? packageType : "BOX";
        this.weightKg = weightKg != null ? weightKg : BigDecimal.ZERO;
        this.dimensionsCm = dimensionsCm;
        this.contentsSummary = contentsSummary;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getChallanId() { return challanId; }
    public String getPackageNumber() { return packageNumber; }
    public String getPackageType() { return packageType; }
    public BigDecimal getWeightKg() { return weightKg; }
    public String getDimensionsCm() { return dimensionsCm; }
    public String getContentsSummary() { return contentsSummary; }
    public Instant getCreatedAt() { return createdAt; }
}
