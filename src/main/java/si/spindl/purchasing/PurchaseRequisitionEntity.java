package si.spindl.purchasing;

import jakarta.persistence.*;
import si.spindl.catalog.ItemEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="purchase_requisitions",uniqueConstraints={@UniqueConstraint(name="uk_purchase_requisitions_tenant_number",columnNames={"tenant_id","requisition_number"}),@UniqueConstraint(name="uk_purchase_requisitions_tenant_idempotency",columnNames={"tenant_id","idempotency_key"}),@UniqueConstraint(name="uk_purchase_requisitions_purchase_order",columnNames={"purchase_order_id"})})
public class PurchaseRequisitionEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="requisition_number",nullable=false,length=64) private String requisitionNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="request_hash",nullable=false,length=64) private String requestHash;
    @Column(name="requested_by",nullable=false) private UUID requestedBy;
    @Column(nullable=false,length=20) private String status="SUBMITTED";
    @Column(name="need_by_date") private LocalDate needByDate;
    @Column(length=1000) private String notes;
    @Column(name="approved_by") private UUID approvedBy;
    @Column(name="approved_at") private Instant approvedAt;
    @Column(name="rejected_by") private UUID rejectedBy;
    @Column(name="rejected_at") private Instant rejectedAt;
    @Column(name="rejection_reason",length=500) private String rejectionReason;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="purchase_order_id") private PurchaseOrderEntity purchaseOrder;
    @Column(name="conversion_idempotency_key",length=120) private String conversionIdempotencyKey;
    @Column(name="conversion_request_hash",length=64) private String conversionRequestHash;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @OneToMany(mappedBy="requisition",cascade=CascadeType.ALL,orphanRemoval=true) private List<PurchaseRequisitionLineEntity> lines=new ArrayList<>();
    protected PurchaseRequisitionEntity(){}
    public PurchaseRequisitionEntity(UUID tenantId,String number,String idempotencyKey,String requestHash,UUID requestedBy,LocalDate needByDate,String notes){this.tenantId=tenantId;this.requisitionNumber=number;this.idempotencyKey=idempotencyKey;this.requestHash=requestHash;this.requestedBy=requestedBy;this.needByDate=needByDate;this.notes=notes;}
    public void addLine(ItemEntity item,int quantity){lines.add(new PurchaseRequisitionLineEntity(tenantId,this,item,quantity));}
    public void approve(UUID actorId){if(!status.equals("SUBMITTED"))throw new IllegalStateException("Only submitted requisitions can be approved");status="APPROVED";approvedBy=actorId;approvedAt=Instant.now();}
    public void reject(UUID actorId,String reason){if(!status.equals("SUBMITTED"))throw new IllegalStateException("Only submitted requisitions can be rejected");status="REJECTED";rejectedBy=actorId;rejectedAt=Instant.now();rejectionReason=reason;}
    public void convert(PurchaseOrderEntity order,String key,String hash){if(!status.equals("APPROVED"))throw new IllegalStateException("Only approved requisitions can be converted");status="CONVERTED";purchaseOrder=order;conversionIdempotencyKey=key;conversionRequestHash=hash;}
    public boolean matchesConversion(String key,String hash){return java.util.Objects.equals(conversionIdempotencyKey,key)&&java.util.Objects.equals(conversionRequestHash,hash);}
    @PrePersist void onCreate(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public String getRequisitionNumber(){return requisitionNumber;} public String getIdempotencyKey(){return idempotencyKey;} public String getRequestHash(){return requestHash;} public UUID getRequestedBy(){return requestedBy;} public String getStatus(){return status;} public LocalDate getNeedByDate(){return needByDate;} public String getNotes(){return notes;} public UUID getApprovedBy(){return approvedBy;} public Instant getApprovedAt(){return approvedAt;} public UUID getRejectedBy(){return rejectedBy;} public Instant getRejectedAt(){return rejectedAt;} public String getRejectionReason(){return rejectionReason;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public String getConversionIdempotencyKey(){return conversionIdempotencyKey;} public String getConversionRequestHash(){return conversionRequestHash;} public Instant getCreatedAt(){return createdAt;} public List<PurchaseRequisitionLineEntity> getLines(){return lines;}
}
