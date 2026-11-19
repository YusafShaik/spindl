package si.spindl.workforce;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workforce_skills")
public class WorkforceSkillEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "skill_code", nullable = false, length = 32)
    private String skillCode;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "category", nullable = false, length = 64)
    private String category; // MACHINING, WELDING_JOINING, INSPECTION_METROLOGY, HEAT_TREATMENT, ASSEMBLY

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "min_cert_hours", nullable = false)
    private int minCertHours = 40;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public WorkforceSkillEntity() {}

    public WorkforceSkillEntity(UUID tenantId, String skillCode, String name, String category, String description, int minCertHours) {
        this.tenantId = tenantId;
        this.skillCode = skillCode;
        this.name = name;
        this.category = category;
        this.description = description;
        this.minCertHours = minCertHours;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getSkillCode() { return skillCode; }
    public void setSkillCode(String skillCode) { this.skillCode = skillCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getMinCertHours() { return minCertHours; }
    public void setMinCertHours(int minCertHours) { this.minCertHours = minCertHours; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
