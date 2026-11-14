package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetTokenEntity {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    protected PasswordResetTokenEntity() {}
    public PasswordResetTokenEntity(UUID id, UUID userId, String tokenHash, Instant expiresAt) { this.id = id; this.userId = userId; this.tokenHash = tokenHash; this.expiresAt = expiresAt; }
    public UUID getUserId() { return userId; }
    public boolean isUsable() { return consumedAt == null && expiresAt.isAfter(Instant.now()); }
    public void consume() { consumedAt = Instant.now(); }
}
