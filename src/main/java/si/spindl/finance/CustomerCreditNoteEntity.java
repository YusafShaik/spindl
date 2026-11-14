package si.spindl.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name="customer_credit_notes",uniqueConstraints={@UniqueConstraint(name="uk_customer_credit_notes_tenant_number",columnNames={"tenant_id","credit_number"}),@UniqueConstraint(name="uk_customer_credit_notes_tenant_idempotency",columnNames={"tenant_id","idempotency_key"})})
public class CustomerCreditNoteEntity {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="invoice_id",nullable=false) private InvoiceEntity invoice;
    @Column(name="credit_number",nullable=false,length=64) private String creditNumber;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="request_hash",nullable=false,length=64) private String requestHash;
    @Column(nullable=false,length=500) private String reason;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="refund_due",nullable=false,precision=14,scale=2) private BigDecimal refundDue;
    @Column(name="amount_refunded",nullable=false,precision=14,scale=2) private BigDecimal amountRefunded=BigDecimal.ZERO;
    @Column(name="issued_at",nullable=false,updatable=false) private Instant issuedAt;
    @OneToMany(mappedBy="creditNote",cascade=CascadeType.ALL,orphanRemoval=true) private List<CustomerCreditNoteLineEntity> lines=new ArrayList<>();
    @OneToMany(mappedBy="creditNote",cascade=CascadeType.ALL,orphanRemoval=true) private List<CustomerCreditRefundEntity> refunds=new ArrayList<>();
    protected CustomerCreditNoteEntity(){}
    public CustomerCreditNoteEntity(UUID tenantId,InvoiceEntity invoice,String creditNumber,String idempotencyKey,String requestHash,String reason,BigDecimal subtotal,BigDecimal taxTotal,BigDecimal total,BigDecimal refundDue){this.tenantId=tenantId;this.invoice=invoice;this.creditNumber=creditNumber;this.idempotencyKey=idempotencyKey;this.requestHash=requestHash;this.reason=reason;this.subtotal=subtotal;this.taxTotal=taxTotal;this.total=total;this.refundDue=refundDue;}
    public void addLine(InvoiceLineEntity invoiceLine,int quantity,String disposition,BigDecimal subtotal,BigDecimal taxAmount,BigDecimal total){lines.add(new CustomerCreditNoteLineEntity(tenantId,this,invoiceLine,quantity,disposition,subtotal,taxAmount,total));}
    public void addRefund(CustomerCreditRefundEntity refund){refunds.add(refund);amountRefunded=amountRefunded.add(refund.getAmount());}
    public boolean matches(UUID invoiceId,String hash){return invoice.getId().equals(invoiceId)&&requestHash.equals(hash);}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public InvoiceEntity getInvoice(){return invoice;}public String getCreditNumber(){return creditNumber;}public String getIdempotencyKey(){return idempotencyKey;}public String getReason(){return reason;}public BigDecimal getSubtotal(){return subtotal;}public BigDecimal getTaxTotal(){return taxTotal;}public BigDecimal getTotal(){return total;}public BigDecimal getRefundDue(){return refundDue;}public BigDecimal getAmountRefunded(){return amountRefunded;}public BigDecimal getRefundBalance(){return refundDue.subtract(amountRefunded);}public Instant getIssuedAt(){return issuedAt;}public List<CustomerCreditNoteLineEntity> getLines(){return lines;}public List<CustomerCreditRefundEntity> getRefunds(){return refunds;}
    @PrePersist void onCreate(){issuedAt=Instant.now();}
}
