package si.spindl.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="invoice_payments",uniqueConstraints=@UniqueConstraint(name="uk_invoice_payments_tenant_invoice_idempotency",columnNames={"tenant_id","invoice_id","idempotency_key"}))
public class InvoicePaymentEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="invoice_id",nullable=false) private InvoiceEntity invoice;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal amount;
    @Column(nullable=false,length=32) private String method;
    @Column(length=120) private String reference;
    @Column(name="received_at",nullable=false,updatable=false) private Instant receivedAt;
    protected InvoicePaymentEntity(){}
    public InvoicePaymentEntity(UUID tenantId,InvoiceEntity invoice,String key,BigDecimal amount,String method,String reference){this.tenantId=tenantId;this.invoice=invoice;this.idempotencyKey=key;this.amount=amount;this.method=method;this.reference=reference;}
    @PrePersist void onCreate(){receivedAt=Instant.now();}
    public UUID getId(){return id;} public String getIdempotencyKey(){return idempotencyKey;} public BigDecimal getAmount(){return amount;} public String getMethod(){return method;} public String getReference(){return reference;} public Instant getReceivedAt(){return receivedAt;}
    public boolean matches(UUID invoiceId,BigDecimal requestedAmount,String requestedMethod,String requestedReference){return invoice.getId().equals(invoiceId)&&amount.compareTo(requestedAmount)==0&&method.equals(requestedMethod)&&java.util.Objects.equals(reference,requestedReference);}
}
