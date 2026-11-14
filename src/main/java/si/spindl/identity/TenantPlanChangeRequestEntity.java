package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name="tenant_plan_change_requests")
public class TenantPlanChangeRequestEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="requested_by",nullable=false) private UUID requestedBy;
    @Column(name="current_plan_code",nullable=false,length=40) private String currentPlanCode;
    @Column(name="current_plan_version",nullable=false) private int currentPlanVersion;
    @Column(name="target_plan_code",nullable=false,length=40) private String targetPlanCode;
    @Column(name="target_plan_version",nullable=false) private int targetPlanVersion;
    @Column(name="effective_date",nullable=false) private LocalDate effectiveDate;
    @Column(nullable=false,length=20) private String status="REQUESTED";
    @CreationTimestamp @Column(name="requested_at",nullable=false,updatable=false) private Instant requestedAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt=Instant.now();
    @Column(name="reviewed_by") private UUID reviewedBy;
    @Column(name="reviewed_at") private Instant reviewedAt;
    @Column(name="review_note",length=500) private String reviewNote;
    @Column(name="applied_at") private Instant appliedAt;
    protected TenantPlanChangeRequestEntity(){}
    public TenantPlanChangeRequestEntity(UUID tenantId,UUID requestedBy,String currentPlanCode,int currentPlanVersion,String targetPlanCode,int targetPlanVersion,LocalDate effectiveDate){this.tenantId=tenantId;this.requestedBy=requestedBy;this.currentPlanCode=currentPlanCode;this.currentPlanVersion=currentPlanVersion;this.targetPlanCode=targetPlanCode;this.targetPlanVersion=targetPlanVersion;this.effectiveDate=effectiveDate;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getRequestedBy(){return requestedBy;}public String getCurrentPlanCode(){return currentPlanCode;}public int getCurrentPlanVersion(){return currentPlanVersion;}public String getTargetPlanCode(){return targetPlanCode;}public int getTargetPlanVersion(){return targetPlanVersion;}public LocalDate getEffectiveDate(){return effectiveDate;}public String getStatus(){return status;}public Instant getRequestedAt(){return requestedAt;}
    public void cancel(){if(!"REQUESTED".equals(status))throw new IllegalStateException("Only pending plan requests can be cancelled");status="CANCELLED";updatedAt=Instant.now();}
    public void approve(UUID actorId,String note){if(!"REQUESTED".equals(status))throw new IllegalStateException("Only pending plan requests can be approved");status="APPROVED";reviewedBy=actorId;reviewedAt=Instant.now();reviewNote=note;updatedAt=reviewedAt;}
    public void reject(UUID actorId,String note){if(!"REQUESTED".equals(status))throw new IllegalStateException("Only pending plan requests can be rejected");status="REJECTED";reviewedBy=actorId;reviewedAt=Instant.now();reviewNote=note;updatedAt=reviewedAt;}
    public void markApplied(){if(!"APPROVED".equals(status))throw new IllegalStateException("Only approved plan requests can be applied");status="APPLIED";appliedAt=Instant.now();updatedAt=appliedAt;}
    public void rejectApplication(String note){if(!"APPROVED".equals(status))throw new IllegalStateException("Only approved plan requests can be rejected");status="REJECTED";reviewNote=note;updatedAt=Instant.now();}
    public UUID getReviewedBy(){return reviewedBy;}public Instant getReviewedAt(){return reviewedAt;}public String getReviewNote(){return reviewNote;}public Instant getAppliedAt(){return appliedAt;}
}
