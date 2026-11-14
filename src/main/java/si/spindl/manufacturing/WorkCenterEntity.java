package si.spindl.manufacturing;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;
@Entity @Table(name="work_centers",uniqueConstraints=@UniqueConstraint(name="uk_work_center_tenant_code",columnNames={"tenant_id","code"}))
public class WorkCenterEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=40) private String code;
    @Column(nullable=false,length=120) private String name;
    @Column(length=500) private String description;
    @Column(name="labor_rate_per_hour",nullable=false,precision=14,scale=4) private BigDecimal laborRatePerHour=BigDecimal.ZERO;
    @Column(name="overhead_rate_per_hour",nullable=false,precision=14,scale=4) private BigDecimal overheadRatePerHour=BigDecimal.ZERO;
    @Column(nullable=false) private boolean active=true;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WorkCenterEntity(){}
    public WorkCenterEntity(UUID tenantId,String code,String name,String description,BigDecimal laborRatePerHour,BigDecimal overheadRatePerHour){this.tenantId=tenantId;this.code=code;this.name=name;this.description=description;this.laborRatePerHour=laborRatePerHour;this.overheadRatePerHour=overheadRatePerHour;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getCode(){return code;}public String getName(){return name;}public String getDescription(){return description;}public BigDecimal getLaborRatePerHour(){return laborRatePerHour;}public BigDecimal getOverheadRatePerHour(){return overheadRatePerHour;}public boolean isActive(){return active;}public void setActive(boolean active){this.active=active;}
}
