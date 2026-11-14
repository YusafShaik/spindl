package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_module_entitlements", uniqueConstraints =
        @UniqueConstraint(name = "uk_tenant_module_entitlement", columnNames = {"tenant_id", "module_code"}))
public class TenantModuleEntitlementEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "module_code", nullable = false, length = 40) private String moduleCode;
    @Column(nullable = false) private boolean entitled = true;
    @Column(nullable = false) private boolean enabled = true;
    @Column(name = "source_plan", nullable = false, length = 40) private String sourcePlan = "TRIAL";
    @Column(name = "plan_version", nullable = false) private int planVersion = 1;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected TenantModuleEntitlementEntity() {}

    public TenantModuleEntitlementEntity(UUID tenantId, String moduleCode) {
        this.tenantId = tenantId;
        this.moduleCode = moduleCode;
    }

    @PrePersist @PreUpdate void touch() { updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getModuleCode() { return moduleCode; }
    public boolean isEntitled() { return entitled; }
    public boolean isEnabled() { return enabled; }
    public String getSourcePlan() { return sourcePlan; }
    public int getPlanVersion() { return planVersion; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setEnabled(boolean enabled) {
        if (enabled && !entitled) throw new IllegalStateException("Module is not included in the tenant plan");
        this.enabled = enabled;
    }
    public void applyPlan(String planCode,int version,boolean included){this.sourcePlan=planCode;this.planVersion=version;this.entitled=included;if(!included)this.enabled=false;}
}
