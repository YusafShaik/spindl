package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="purchase_orders", uniqueConstraints=@UniqueConstraint(name="uk_purchase_orders_tenant_number", columnNames={"tenant_id","order_number"}))
public class PurchaseOrderEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="order_number",nullable=false,length=64) private String orderNumber;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_id",nullable=false) private SupplierEntity supplier;
    @Column(name="created_by") private UUID createdBy;
    @Column(name="approval_required_count",nullable=false) private short approvalRequiredCount=1;
    @Column(nullable=false,length=32) private String status="draft";
    @Column(length=1000) private String notes;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @OneToMany(mappedBy="purchaseOrder",cascade=CascadeType.ALL,orphanRemoval=true)
    private List<PurchaseOrderLineEntity> lines=new ArrayList<>();

    protected PurchaseOrderEntity(){}
    public PurchaseOrderEntity(UUID tenantId,String orderNumber,SupplierEntity supplier,String notes){this(tenantId,orderNumber,supplier,notes,null);}
    public PurchaseOrderEntity(UUID tenantId,String orderNumber,SupplierEntity supplier,String notes,UUID createdBy){this.tenantId=tenantId;this.orderNumber=orderNumber;this.supplier=supplier;this.notes=notes;this.createdBy=createdBy;}
    public void addLine(ItemEntity item,int quantity,BigDecimal unitPrice){lines.add(new PurchaseOrderLineEntity(this,tenantId,item,quantity,unitPrice));}
    @PrePersist void onCreate(){createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void onUpdate(){updatedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getOrderNumber(){return orderNumber;} public SupplierEntity getSupplier(){return supplier;} public String getStatus(){return status;} public String getNotes(){return notes;} public Instant getCreatedAt(){return createdAt;} public List<PurchaseOrderLineEntity> getLines(){return lines;}public UUID getCreatedBy(){return createdBy;}public short getApprovalRequiredCount(){return approvalRequiredCount;}
    public void startApproval(int requiredApprovals){if(!status.equals("draft"))throw new IllegalStateException("Only draft purchase orders can enter approval");if(requiredApprovals<1||requiredApprovals>3)throw new IllegalArgumentException("Required approvers must be between 1 and 3");approvalRequiredCount=(short)requiredApprovals;status="pending_approval";}
    public void approve(){if(!status.equals("pending_approval")&&!status.equals("draft"))throw new IllegalStateException("Only pending purchase orders can be approved");status="approved";}
    public void refreshReceiptStatus(){status=lines.stream().allMatch(PurchaseOrderLineEntity::isFullyReceived)?"received":"partially_received";}
    public BigDecimal getTotal(){return lines.stream().map(line->line.getUnitPrice().multiply(BigDecimal.valueOf(line.getOrderedQuantity()))).reduce(BigDecimal.ZERO,BigDecimal::add);}
}
