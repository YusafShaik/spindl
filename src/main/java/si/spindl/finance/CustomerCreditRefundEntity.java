package si.spindl.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="customer_credit_refunds",uniqueConstraints=@UniqueConstraint(name="uk_customer_credit_refunds_tenant_note_key",columnNames={"tenant_id","credit_note_id","idempotency_key"}))
public class CustomerCreditRefundEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="credit_note_id",nullable=false) private CustomerCreditNoteEntity creditNote;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal amount;
    @Column(nullable=false,length=32) private String method;
    @Column(length=120) private String reference;
    @Column(name="refunded_at",nullable=false,updatable=false) private Instant refundedAt;
    protected CustomerCreditRefundEntity(){}
    public CustomerCreditRefundEntity(UUID tenantId,CustomerCreditNoteEntity note,String key,BigDecimal amount,String method,String reference){this.tenantId=tenantId;this.creditNote=note;this.idempotencyKey=key;this.amount=amount;this.method=method;this.reference=reference;}
    @PrePersist void onCreate(){refundedAt=Instant.now();}
    public UUID getId(){return id;}public BigDecimal getAmount(){return amount;}public String getMethod(){return method;}public String getReference(){return reference;}public Instant getRefundedAt(){return refundedAt;}public String getIdempotencyKey(){return idempotencyKey;}
    public boolean matches(UUID noteId,BigDecimal requestedAmount,String requestedMethod,String requestedReference){return creditNote.getId().equals(noteId)&&amount.compareTo(requestedAmount)==0&&method.equals(requestedMethod)&&java.util.Objects.equals(reference,requestedReference);}
}
