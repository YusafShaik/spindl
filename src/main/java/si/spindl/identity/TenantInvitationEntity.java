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
@Table(name = "tenant_invitations")
public class TenantInvitationEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(nullable = false, length = 254) private String email;
    @Column(nullable = false, length = 24) private String role;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "invited_by", nullable = false) private UUID invitedBy;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "accepted_at") private Instant acceptedAt;
    @Column(name = "accepted_user_id") private UUID acceptedUserId;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TenantInvitationEntity() {}
    public TenantInvitationEntity(UUID tenantId, String email, String role, String tokenHash, UUID invitedBy, Instant expiresAt) {
        this.tenantId = tenantId; this.email = email; this.role = role; this.tokenHash = tokenHash; this.invitedBy = invitedBy; this.expiresAt = expiresAt;
    }
    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isAccepted() { return acceptedAt != null; }
    public boolean isExpired() { return !expiresAt.isAfter(Instant.now()); }
    public void accept(UUID userId) { this.acceptedAt = Instant.now(); this.acceptedUserId = userId; }
}
