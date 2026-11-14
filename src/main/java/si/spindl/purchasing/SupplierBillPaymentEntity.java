package si.spindl.purchasing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name="supplier_bill_payments",uniqueConstraints=@UniqueConstraint(name="uk_supplier_bill_payments_tenant_bill_idempotency",columnNames={"tenant_id","supplier_bill_id","idempotency_key"}))
public class SupplierBillPaymentEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_bill_id",nullable=false) private SupplierBillEntity bill;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal amount;
    @Column(nullable=false,length=32) private String method;
    @Column(length=120) private String reference;
    @Column(name="paid_at",nullable=false,updatable=false) private Instant paidAt;
    protected SupplierBillPaymentEntity(){}
    public SupplierBillPaymentEntity(UUID tenantId,SupplierBillEntity bill,String key,BigDecimal amount,String method,String reference){this.tenantId=tenantId;this.bill=bill;this.idempotencyKey=key;this.amount=amount;this.method=method;this.reference=reference;}
    @PrePersist void onCreate(){paidAt=Instant.now();}
    public String getIdempotencyKey(){return idempotencyKey;} public BigDecimal getAmount(){return amount;} public String getMethod(){return method;} public String getReference(){return reference;}
    public boolean matches(UUID billId,BigDecimal requestedAmount,String requestedMethod,String requestedReference){return bill.getId().equals(billId)&&amount.compareTo(requestedAmount)==0&&method.equals(requestedMethod)&&Objects.equals(reference,requestedReference);}
}
