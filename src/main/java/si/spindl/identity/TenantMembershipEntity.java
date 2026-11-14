package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_memberships")
public class TenantMembershipEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false, length = 24) private String role;
    @Column(name="manager_user_id") private UUID managerUserId;
    @Column(nullable = false) private boolean active = true;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TenantMembershipEntity() {}
    public TenantMembershipEntity(UUID tenantId, UUID userId, String role) { this.tenantId = tenantId; this.userId = userId; this.role = role; }
    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public UUID getManagerUserId(){return managerUserId;}
    public String getRole() { return role; }
    public boolean isActive() { return active; }
    public void changeRole(String role) { this.role = role; }
    public void setActive(boolean active) { this.active = active; }
    public void setManagerUserId(UUID managerUserId){this.managerUserId=managerUserId;}
}
