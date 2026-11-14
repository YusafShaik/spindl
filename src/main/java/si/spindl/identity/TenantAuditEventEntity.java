package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "tenant_audit_events")
public class TenantAuditEventEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "actor_user_id") private UUID actorUserId;
    @Column(name = "event_type", nullable = false, length = 80) private String eventType;
    @Column(name = "subject_type", nullable = false, length = 80) private String subjectType;
    @Column(name = "subject_id") private UUID subjectId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private Map<String, Object> details = Map.of();
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TenantAuditEventEntity() {}
    public TenantAuditEventEntity(UUID tenantId, UUID actorUserId, String eventType, String subjectType, UUID subjectId, Map<String, Object> details) {
        this.tenantId = tenantId; this.actorUserId = actorUserId; this.eventType = eventType; this.subjectType = subjectType; this.subjectId = subjectId; this.details = details;
    }
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getActorUserId(){return actorUserId;}public String getEventType(){return eventType;}public String getSubjectType(){return subjectType;}public UUID getSubjectId(){return subjectId;}public Map<String,Object> getDetails(){return details;}public Instant getCreatedAt(){return createdAt;}
}
