package si.spindl.purchasing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="purchase_order_approvals",uniqueConstraints=@UniqueConstraint(name="uk_po_approval_actor",columnNames={"tenant_id","purchase_order_id","approver_user_id"}))
public class PurchaseOrderApprovalEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="purchase_order_id",nullable=false) private UUID purchaseOrderId;
    @Column(name="approver_user_id",nullable=false) private UUID approverUserId;
    @CreationTimestamp @Column(name="approved_at",nullable=false,updatable=false) private Instant approvedAt;
    protected PurchaseOrderApprovalEntity(){}
    public PurchaseOrderApprovalEntity(UUID tenantId,UUID orderId,UUID approverId){this.tenantId=tenantId;this.purchaseOrderId=orderId;this.approverUserId=approverId;}
}
