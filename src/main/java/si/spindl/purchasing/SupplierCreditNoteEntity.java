package si.spindl.purchasing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="supplier_credit_notes",uniqueConstraints={@UniqueConstraint(name="uk_supplier_credit_notes_tenant_number",columnNames={"tenant_id","credit_number"}),@UniqueConstraint(name="uk_supplier_credit_notes_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class SupplierCreditNoteEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_bill_id",nullable=false) private SupplierBillEntity bill;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_id",nullable=false) private PurchaseOrderEntity purchaseOrder;
    @Column(name="credit_number",nullable=false,length=64) private String creditNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,length=500) private String reason;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="issued_at",nullable=false,updatable=false) private Instant issuedAt;
    @OneToMany(mappedBy="creditNote",cascade=CascadeType.ALL,orphanRemoval=true) private List<SupplierCreditNoteLineEntity> lines=new ArrayList<>();
    protected SupplierCreditNoteEntity(){}
    public SupplierCreditNoteEntity(UUID tenantId,SupplierBillEntity bill,PurchaseOrderEntity order,String number,String key,String reason,BigDecimal total){this.tenantId=tenantId;this.bill=bill;this.purchaseOrder=order;this.creditNumber=number;this.idempotencyKey=key;this.reason=reason;this.total=total;}
    public void addLine(UUID tenantId,SupplierBillLineEntity billLine,int quantity){lines.add(new SupplierCreditNoteLineEntity(tenantId,this,billLine,quantity));}
    @PrePersist void onCreate(){issuedAt=Instant.now();}
    public UUID getId(){return id;} public String getCreditNumber(){return creditNumber;} public SupplierBillEntity getBill(){return bill;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public String getReason(){return reason;} public BigDecimal getTotal(){return total;} public Instant getIssuedAt(){return issuedAt;} public List<SupplierCreditNoteLineEntity> getLines(){return lines;} public int getCreditedUnits(){return lines.stream().mapToInt(SupplierCreditNoteLineEntity::getQuantity).sum();}
    public boolean matches(UUID billId,String requestedReason,List<SupplierBillDtos.CreditLine> requestedLines){java.util.Map<UUID,Integer> requested=new java.util.HashMap<>();requestedLines.forEach(line->requested.put(line.supplierBillLineId(),line.quantity()));java.util.Map<UUID,Integer> stored=new java.util.HashMap<>();lines.forEach(line->stored.put(line.getBillLine().getId(),line.getQuantity()));return bill.getId().equals(billId)&&reason.equals(requestedReason)&&stored.equals(requested);}
}
