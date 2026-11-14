package si.spindl.manufacturing;
import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="work_order_operations",uniqueConstraints={@UniqueConstraint(name="uk_work_order_operation_sequence",columnNames={"work_order_id","sequence"}),@UniqueConstraint(name="uk_work_order_operation_completion",columnNames={"tenant_id","completion_key"})})
public class WorkOrderOperationEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="work_order_id",nullable=false) private UUID workOrderId;
    @Column(nullable=false) private int sequence;
    @Column(nullable=false,length=120) private String name;
    @Column(name="work_center_id",nullable=false) private UUID workCenterId;
    @Column(name="work_center_code",nullable=false,length=40) private String workCenterCode;
    @Column(name="work_center_name",nullable=false,length=120) private String workCenterName;
    @Column(name="setup_minutes",nullable=false) private int setupMinutes;
    @Column(name="run_minutes_per_unit",nullable=false,precision=10,scale=2) private BigDecimal runMinutesPerUnit;
    @Column(name="labor_rate_per_hour",nullable=false,precision=14,scale=4) private BigDecimal laborRatePerHour=BigDecimal.ZERO;
    @Column(name="overhead_rate_per_hour",nullable=false,precision=14,scale=4) private BigDecimal overheadRatePerHour=BigDecimal.ZERO;
    @Column(name="labor_cost_amount",precision=14,scale=2) private BigDecimal laborCostAmount;
    @Column(name="overhead_cost_amount",precision=14,scale=2) private BigDecimal overheadCostAmount;
    @Column(name="skill_requirements",length=240) private String skillRequirements;
    @Column(nullable=false,length=16) private String status="PENDING";
    @Column(name="operator_user_id") private UUID operatorUserId;
    @Column(name="started_at") private Instant startedAt;
    @Column(name="completed_at") private Instant completedAt;
    @Column(name="actual_setup_minutes") private Integer actualSetupMinutes;
    @Column(name="actual_run_minutes") private Integer actualRunMinutes;
    @Column(name="produced_quantity",nullable=false) private int producedQuantity;
    @Column(name="scrap_quantity",nullable=false) private int scrapQuantity;
    @Column(name="rework_quantity",nullable=false) private int reworkQuantity;
    @Column(name="downtime_minutes",nullable=false) private int downtimeMinutes;
    @Column(name="downtime_reason",length=240) private String downtimeReason;
    @Column(name="completion_key",length=120) private String completionKey;
    protected WorkOrderOperationEntity(){}
    public WorkOrderOperationEntity(UUID tenantId,UUID workOrderId,BomOperationEntity operation,WorkCenterEntity center){this.tenantId=tenantId;this.workOrderId=workOrderId;this.sequence=operation.getSequence();this.name=operation.getName();this.workCenterId=center.getId();this.workCenterCode=center.getCode();this.workCenterName=center.getName();this.setupMinutes=operation.getSetupMinutes();this.runMinutesPerUnit=operation.getRunMinutesPerUnit();this.laborRatePerHour=center.getLaborRatePerHour();this.overheadRatePerHour=center.getOverheadRatePerHour();this.skillRequirements=operation.getSkillRequirements();}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getWorkOrderId(){return workOrderId;}public int getSequence(){return sequence;}public String getName(){return name;}public UUID getWorkCenterId(){return workCenterId;}public String getWorkCenterCode(){return workCenterCode;}public String getWorkCenterName(){return workCenterName;}public int getSetupMinutes(){return setupMinutes;}public BigDecimal getRunMinutesPerUnit(){return runMinutesPerUnit;}public String getSkillRequirements(){return skillRequirements;}public String getStatus(){return status;}public UUID getOperatorUserId(){return operatorUserId;}public Instant getStartedAt(){return startedAt;}public Instant getCompletedAt(){return completedAt;}public Integer getActualSetupMinutes(){return actualSetupMinutes;}public Integer getActualRunMinutes(){return actualRunMinutes;}public int getProducedQuantity(){return producedQuantity;}public int getScrapQuantity(){return scrapQuantity;}public int getReworkQuantity(){return reworkQuantity;}public int getDowntimeMinutes(){return downtimeMinutes;}public String getDowntimeReason(){return downtimeReason;}public String getCompletionKey(){return completionKey;}public BigDecimal getLaborRatePerHour(){return laborRatePerHour;}public BigDecimal getOverheadRatePerHour(){return overheadRatePerHour;}public BigDecimal getLaborCostAmount(){return laborCostAmount;}public BigDecimal getOverheadCostAmount(){return overheadCostAmount;}
    public void start(UUID operatorId){status="IN_PROGRESS";operatorUserId=operatorId;startedAt=Instant.now();}
    public void assign(UUID operatorId){if(!"PENDING".equals(status))throw new IllegalStateException("Only pending job cards can be assigned");operatorUserId=operatorId;}
    public void complete(int good,int scrap,int rework,int actualSetup,int actualRun,int downtime,String reason,String key){status="COMPLETED";completedAt=Instant.now();producedQuantity=good;scrapQuantity=scrap;reworkQuantity=rework;actualSetupMinutes=actualSetup;actualRunMinutes=actualRun;downtimeMinutes=downtime;downtimeReason=reason;completionKey=key;BigDecimal hours=BigDecimal.valueOf((long)actualSetup+actualRun).divide(BigDecimal.valueOf(60),8,java.math.RoundingMode.HALF_UP);laborCostAmount=hours.multiply(laborRatePerHour).setScale(2,java.math.RoundingMode.HALF_UP);overheadCostAmount=hours.multiply(overheadRatePerHour).setScale(2,java.math.RoundingMode.HALF_UP);}
    public boolean matchesCompletion(ManufacturingDtos.CompleteOperationRequest r){return producedQuantity==r.producedQuantity()&&scrapQuantity==r.scrapQuantity()&&reworkQuantity==r.reworkQuantity()&&actualSetupMinutes==r.actualSetupMinutes()&&actualRunMinutes==r.actualRunMinutes()&&downtimeMinutes==r.downtimeMinutes()&&java.util.Objects.equals(downtimeReason,r.downtimeReason());}
}
