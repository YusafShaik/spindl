package si.spindl.purchasing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="supplier_bills",uniqueConstraints={@UniqueConstraint(name="uk_supplier_bills_tenant_number",columnNames={"tenant_id","bill_number"}),@UniqueConstraint(name="uk_supplier_bills_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class SupplierBillEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_id",nullable=false) private SupplierEntity supplier;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="purchase_order_id",nullable=false) private PurchaseOrderEntity purchaseOrder;
    @Column(name="bill_number",nullable=false,length=64) private String billNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,length=24) private String status="unpaid";
    @Column(name="due_date",nullable=false) private LocalDate dueDate;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="amount_paid",nullable=false,precision=14,scale=2) private BigDecimal amountPaid=BigDecimal.ZERO;
    @Column(name="amount_credited",nullable=false,precision=14,scale=2) private BigDecimal amountCredited=BigDecimal.ZERO;
    @Column(name="issued_at",nullable=false,updatable=false) private Instant issuedAt;
    @OneToMany(mappedBy="bill",cascade=CascadeType.ALL,orphanRemoval=true) private List<SupplierBillLineEntity> lines=new ArrayList<>();
    @OneToMany(mappedBy="bill",cascade=CascadeType.ALL,orphanRemoval=true) private List<SupplierBillPaymentEntity> payments=new ArrayList<>();
    protected SupplierBillEntity(){}
    public SupplierBillEntity(UUID tenantId,SupplierEntity supplier,PurchaseOrderEntity order,String number,String key,LocalDate dueDate,BigDecimal total){this.tenantId=tenantId;this.supplier=supplier;this.purchaseOrder=order;this.billNumber=number;this.idempotencyKey=key;this.dueDate=dueDate;this.total=total;}
    public void addLine(UUID tenantId,PurchaseOrderLineEntity line,int quantity){lines.add(new SupplierBillLineEntity(tenantId,this,line,quantity));}
    public void addPayment(SupplierBillPaymentEntity payment){payments.add(payment);}
    @PrePersist void onCreate(){issuedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public SupplierEntity getSupplier(){return supplier;} public PurchaseOrderEntity getPurchaseOrder(){return purchaseOrder;} public String getBillNumber(){return billNumber;} public String getStatus(){return status;} public LocalDate getDueDate(){return dueDate;} public BigDecimal getTotal(){return total;} public BigDecimal getAmountPaid(){return amountPaid;} public BigDecimal getAmountCredited(){return amountCredited;} public BigDecimal getBalance(){return total.subtract(amountPaid).subtract(amountCredited);} public Instant getIssuedAt(){return issuedAt;} public List<SupplierBillLineEntity> getLines(){return lines;} public List<SupplierBillPaymentEntity> getPayments(){return payments;}
    public void recordPayment(BigDecimal amount){if(amount.signum()<=0||amount.compareTo(getBalance())>0)throw new IllegalArgumentException("Payment must be positive and cannot exceed the remaining balance");amountPaid=amountPaid.add(amount);refreshStatus();}
    public void recordCredit(BigDecimal amount){if(amount.signum()<0||amount.compareTo(getBalance())>0)throw new IllegalArgumentException("Credit cannot be negative or exceed the remaining bill balance");amountCredited=amountCredited.add(amount);refreshStatus();}
    private void refreshStatus(){if(getBalance().signum()==0)status=amountCredited.signum()==0?"paid":amountPaid.signum()==0?"credited":"settled";else if(amountPaid.signum()>0)status="partially_paid";else if(amountCredited.signum()>0)status="partially_credited";else status="unpaid";}
}
