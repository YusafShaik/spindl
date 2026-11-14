package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_notifications")
public class UserNotificationEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audit_event_id", nullable = false) private TenantAuditEventEntity auditEvent;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "read_at") private Instant readAt;

    protected UserNotificationEntity() {}

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public TenantAuditEventEntity getAuditEvent() { return auditEvent; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public void markRead() { if (readAt == null) readAt = Instant.now(); }
}
