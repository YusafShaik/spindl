package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.PreUpdate;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="tenant_subscriptions")
public class TenantSubscriptionEntity {
    @Id @Column(name="tenant_id") private UUID tenantId;
    @Column(name="plan_code",nullable=false,length=40) private String planCode;
    @Column(name="plan_version",nullable=false) private int planVersion;
    @Column(nullable=false,length=20) private String status;
    @CreationTimestamp @Column(name="started_at",nullable=false,updatable=false) private Instant startedAt;
    @Column(name="current_period_ends_at") private Instant currentPeriodEndsAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected TenantSubscriptionEntity(){}
    public TenantSubscriptionEntity(UUID tenantId,String planCode,int planVersion,String status){this.tenantId=tenantId;this.planCode=planCode;this.planVersion=planVersion;this.status=status;this.updatedAt=Instant.now();}
    public UUID getTenantId(){return tenantId;} public String getPlanCode(){return planCode;} public int getPlanVersion(){return planVersion;}
    public String getStatus(){return status;} public Instant getStartedAt(){return startedAt;} public Instant getCurrentPeriodEndsAt(){return currentPeriodEndsAt;}
    public void touch(){updatedAt=Instant.now();}
    public void applyPlan(String planCode,int version){this.planCode=planCode;this.planVersion=version;this.status="ACTIVE";this.updatedAt=Instant.now();}
    @PreUpdate void onUpdate(){touch();}
}
