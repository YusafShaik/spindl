package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_ownership_transfers")
public class TenantOwnershipTransferEntity {
    @Id private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "from_user_id", nullable = false) private UUID fromUserId;
    @Column(name = "to_user_id", nullable = false) private UUID toUserId;
    @Column(name = "token_hash", nullable = false, length = 64) private String tokenHash;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "accepted_at") private Instant acceptedAt;
    @Column(name = "cancelled_at") private Instant cancelledAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TenantOwnershipTransferEntity() {}
    public TenantOwnershipTransferEntity(UUID id, UUID tenantId, UUID fromUserId, UUID toUserId, String tokenHash, Instant expiresAt) {
        this.id=id; this.tenantId=tenantId; this.fromUserId=fromUserId; this.toUserId=toUserId; this.tokenHash=tokenHash; this.expiresAt=expiresAt;
    }
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public UUID getFromUserId(){return fromUserId;}
    public UUID getToUserId(){return toUserId;} public String getTokenHash(){return tokenHash;} public Instant getExpiresAt(){return expiresAt;}
    public boolean isPending(Instant now){return acceptedAt==null && cancelledAt==null && expiresAt.isAfter(now);}
    public void accept(Instant now){acceptedAt=now;}
    public void cancel(Instant now){cancelledAt=now;}
}
