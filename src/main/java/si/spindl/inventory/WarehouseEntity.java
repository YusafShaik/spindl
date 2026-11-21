package si.spindl.inventory;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="warehouses",uniqueConstraints={@UniqueConstraint(name="uk_warehouses_tenant_code",columnNames={"tenant_id","code"}),@UniqueConstraint(name="uk_warehouses_tenant_id",columnNames={"tenant_id","id"})})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WarehouseEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="branch_id",nullable=false) private UUID branchId;
    @Column(nullable=false,length=32) private String code;
    @Column(nullable=false,length=120) private String name;
    @Column(name="is_default",nullable=false) private boolean isDefault;
    @Column(nullable=false) private boolean active=true;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;

    public WarehouseEntity(UUID tenantId,String code,String name,UUID branchId){
        this.tenantId=tenantId;this.code=code;this.name=name;this.branchId=branchId;
    }
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public void markDefault(){isDefault=true;}
}
