package si.spindl.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;
import java.util.UUID;

@Entity
@Table(name="tenant_membership_branches")
public class TenantMembershipBranchEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="user_id",nullable=false) private UUID userId;
    @Column(name="branch_id",nullable=false) private UUID branchId;
    protected TenantMembershipBranchEntity(){}
    public TenantMembershipBranchEntity(UUID tenantId,UUID userId,UUID branchId){this.tenantId=tenantId;this.userId=userId;this.branchId=branchId;}
    public UUID getBranchId(){return branchId;}
}
