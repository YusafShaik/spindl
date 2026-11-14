package si.spindl.manufacturing;
import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.util.UUID;
@Entity @Table(name="bom_operations",uniqueConstraints=@UniqueConstraint(name="uk_bom_operation_sequence",columnNames={"bom_id","sequence"}))
public class BomOperationEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="bom_id",nullable=false) private UUID bomId;
    @Column(nullable=false) private int sequence;
    @Column(nullable=false,length=120) private String name;
    @Column(name="work_center_id",nullable=false) private UUID workCenterId;
    @Column(name="setup_minutes",nullable=false) private int setupMinutes;
    @Column(name="run_minutes_per_unit",nullable=false,precision=10,scale=2) private BigDecimal runMinutesPerUnit;
    @Column(name="skill_requirements",length=240) private String skillRequirements;
    protected BomOperationEntity(){}
    public BomOperationEntity(UUID tenantId,UUID bomId,int sequence,String name,UUID workCenterId,int setupMinutes,BigDecimal runMinutesPerUnit,String skillRequirements){this.tenantId=tenantId;this.bomId=bomId;this.sequence=sequence;this.name=name;this.workCenterId=workCenterId;this.setupMinutes=setupMinutes;this.runMinutesPerUnit=runMinutesPerUnit;this.skillRequirements=skillRequirements;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getBomId(){return bomId;}public int getSequence(){return sequence;}public String getName(){return name;}public UUID getWorkCenterId(){return workCenterId;}public int getSetupMinutes(){return setupMinutes;}public BigDecimal getRunMinutesPerUnit(){return runMinutesPerUnit;}public String getSkillRequirements(){return skillRequirements;}
}
