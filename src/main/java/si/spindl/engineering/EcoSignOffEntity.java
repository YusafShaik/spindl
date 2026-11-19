package si.spindl.engineering;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.identity.AppUserEntity;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "eco_sign_offs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_eco_signoffs_dept", columnNames = {"tenant_id", "eco_id", "department"})
})
public class EcoSignOffEntity {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "eco_id", nullable = false)
    private EngineeringChangeOrderEntity eco;

    @Column(nullable = false, length = 24)
    private String department; // 'ENGINEERING', 'MANUFACTURING', 'QUALITY', 'FINANCE'

    @Column(nullable = false, length = 24)
    private String status = "PENDING"; // 'PENDING', 'APPROVED', 'REJECTED'

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_user_id")
    private AppUserEntity approverUser;

    @Column(name = "sign_off_role", length = 64)
    private String signOffRole;

    @Column(columnDefinition = "TEXT")
    private String comments;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected EcoSignOffEntity() {}

    public EcoSignOffEntity(UUID tenantId, EngineeringChangeOrderEntity eco, String department, String signOffRole) {
        this.tenantId = tenantId;
        this.eco = eco;
        this.department = department;
        this.signOffRole = signOffRole;
        this.status = "PENDING";
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public EngineeringChangeOrderEntity getEco() { return eco; }
    public void setEco(EngineeringChangeOrderEntity eco) { this.eco = eco; }
    public String getDepartment() { return department; }
    public String getStatus() { return status; }
    public AppUserEntity getApproverUser() { return approverUser; }
    public String getSignOffRole() { return signOffRole; }
    public String getComments() { return comments; }
    public Instant getApprovedAt() { return approvedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void approve(AppUserEntity user, String role, String comments) {
        this.status = "APPROVED";
        this.approverUser = user;
        if (role != null && !role.isBlank()) this.signOffRole = role;
        this.comments = comments;
        this.approvedAt = Instant.now();
    }

    public void reject(AppUserEntity user, String role, String comments) {
        this.status = "REJECTED";
        this.approverUser = user;
        if (role != null && !role.isBlank()) this.signOffRole = role;
        this.comments = comments;
        this.approvedAt = Instant.now();
    }
}
