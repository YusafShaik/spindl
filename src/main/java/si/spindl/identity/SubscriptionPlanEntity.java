package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name="subscription_plans")
public class SubscriptionPlanEntity {
    @Id private UUID id;
    @Column(name="plan_code",nullable=false,length=40) private String planCode;
    @Column(nullable=false) private int version;
    @Column(name="display_name",nullable=false,length=100) private String displayName;
    @Column(name="seat_limit",nullable=false) private int seatLimit;
    @Column(name="storage_limit_mb",nullable=false) private int storageLimitMb;
    @Column(name="api_calls_per_month",nullable=false) private long apiCallsPerMonth;
    @Column(nullable=false) private boolean active;
    protected SubscriptionPlanEntity(){}
    public UUID getId(){return id;} public String getPlanCode(){return planCode;} public int getVersion(){return version;}
    public String getDisplayName(){return displayName;} public int getSeatLimit(){return seatLimit;} public int getStorageLimitMb(){return storageLimitMb;}
    public long getApiCallsPerMonth(){return apiCallsPerMonth;} public boolean isActive(){return active;}
}
