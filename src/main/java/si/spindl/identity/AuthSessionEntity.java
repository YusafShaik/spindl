package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_sessions")
public class AuthSessionEntity {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "login_source_hash", length = 64) private String loginSourceHash;
    @Column(name = "revoked_at") private Instant revokedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    protected AuthSessionEntity() {}
    public AuthSessionEntity(UUID id, UUID userId, UUID tenantId, Instant expiresAt) { this.id = id; this.userId = userId; this.tenantId = tenantId; this.expiresAt = expiresAt; }
    public AuthSessionEntity(UUID id, UUID userId, UUID tenantId, Instant expiresAt, String loginSourceHash) { this(id, userId, tenantId, expiresAt); this.loginSourceHash = loginSourceHash; }
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getTenantId() { return tenantId; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void revoke() { this.revokedAt = Instant.now(); }
}
