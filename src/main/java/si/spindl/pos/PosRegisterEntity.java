package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import si.spindl.catalog.WarehouseEntity;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="pos_registers",uniqueConstraints=@UniqueConstraint(name="uk_pos_registers_tenant_code",columnNames={"tenant_id","code"}))
public class PosRegisterEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="warehouse_id",nullable=false) private WarehouseEntity warehouse;
    @Column(nullable=false,length=32) private String code;
    @Column(nullable=false,length=120) private String name;
    @Column(name="assigned_cashier_user_id") private UUID assignedCashierUserId;
    @Column(nullable=false) private boolean active=true;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected PosRegisterEntity(){}
    public PosRegisterEntity(UUID tenantId,WarehouseEntity warehouse,String code,String name,UUID assignedCashierUserId){this.tenantId=tenantId;this.warehouse=warehouse;this.code=code;this.name=name;this.assignedCashierUserId=assignedCashierUserId;}
    @PrePersist void created(){createdAt=Instant.now();}
    public void assignCashier(UUID userId){assignedCashierUserId=userId;}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public WarehouseEntity getWarehouse(){return warehouse;} public String getCode(){return code;} public String getName(){return name;} public UUID getAssignedCashierUserId(){return assignedCashierUserId;} public boolean isActive(){return active;}
}
