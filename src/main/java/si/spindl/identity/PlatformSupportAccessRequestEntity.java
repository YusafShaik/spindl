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
@Table(name="platform_support_access_requests")
public class PlatformSupportAccessRequestEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="requested_by",nullable=false) private UUID requestedBy;
    @Column(name="requester_email",nullable=false,length=254) private String requesterEmail;
    @Column(nullable=false,length=500) private String reason;
    @Column(name="duration_minutes",nullable=false) private short durationMinutes;
    @Column(nullable=false,length=16) private String status="REQUESTED";
    @Column(name="expires_at") private Instant expiresAt;
    @Column(name="reviewed_by") private UUID reviewedBy;
    @Column(name="reviewed_at") private Instant reviewedAt;
    @Column(name="review_note",length=500) private String reviewNote;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt=Instant.now();
    protected PlatformSupportAccessRequestEntity(){}
    public PlatformSupportAccessRequestEntity(UUID tenantId,UUID requestedBy,String requesterEmail,String reason,int durationMinutes){this.tenantId=tenantId;this.requestedBy=requestedBy;this.requesterEmail=requesterEmail;this.reason=reason;this.durationMinutes=(short)durationMinutes;}
    public void approve(UUID reviewerId,String note){if(!"REQUESTED".equals(status))throw new IllegalStateException("Only a pending support request can be approved");reviewedBy=reviewerId;reviewedAt=Instant.now();reviewNote=note;expiresAt=reviewedAt.plusSeconds(durationMinutes*60L);status="APPROVED";updatedAt=reviewedAt;}
    public void reject(UUID reviewerId,String note){if(!"REQUESTED".equals(status))throw new IllegalStateException("Only a pending support request can be rejected");reviewedBy=reviewerId;reviewedAt=Instant.now();reviewNote=note;status="REJECTED";updatedAt=reviewedAt;}
    public void revoke(UUID reviewerId,String note){if(!"APPROVED".equals(status))throw new IllegalStateException("Only an approved support request can be revoked");reviewedBy=reviewerId;reviewedAt=Instant.now();reviewNote=note;status="REVOKED";updatedAt=reviewedAt;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getRequestedBy(){return requestedBy;}public String getRequesterEmail(){return requesterEmail;}public String getReason(){return reason;}public int getDurationMinutes(){return durationMinutes;}public String getStatus(){return status;}public Instant getExpiresAt(){return expiresAt;}public UUID getReviewedBy(){return reviewedBy;}public Instant getReviewedAt(){return reviewedAt;}public String getReviewNote(){return reviewNote;}public Instant getCreatedAt(){return createdAt;}
    public boolean hasActiveConsent(Instant now){return "APPROVED".equals(status)&&expiresAt!=null&&expiresAt.isAfter(now);}
}
