package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="pos_sales",uniqueConstraints={@UniqueConstraint(name="uk_pos_sales_tenant_id",columnNames={"tenant_id","id"}),@UniqueConstraint(name="uk_pos_sales_tenant_idempotency",columnNames={"tenant_id","idempotency_key"}),@UniqueConstraint(name="uk_pos_sales_tenant_receipt",columnNames={"tenant_id","receipt_number"})})
public class PosSaleEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="session_id",nullable=false) private PosRegisterSessionEntity session;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="payload_hash",nullable=false,length=64) private String payloadHash;
    @Column(name="receipt_number",nullable=false,length=64) private String receiptNumber;
    @Column(name="customer_id") private UUID customerId;
    @Column(nullable=false,length=16) private String status="POSTED";
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_code",nullable=false,length=24) private String taxCode;
    @Column(name="tax_rate",nullable=false,precision=5,scale=2) private BigDecimal taxRate;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="refunded_total",nullable=false,precision=14,scale=2) private BigDecimal refundedTotal=BigDecimal.ZERO;
    @Column(name="void_idempotency_key",length=120) private String voidIdempotencyKey;
    @Column(name="void_payload_hash",length=64) private String voidPayloadHash;
    @Column(name="void_reason",length=300) private String voidReason;
    @Column(name="voided_by") private UUID voidedBy;
    @Column(name="voided_at") private Instant voidedAt;
    @Column(name="posted_at",nullable=false,updatable=false) private Instant postedAt;
    protected PosSaleEntity(){}
    public PosSaleEntity(UUID tenantId,PosRegisterSessionEntity session,String key,String payloadHash,String receipt,UUID customerId,BigDecimal subtotal,String taxCode,BigDecimal taxRate,BigDecimal taxTotal){this.tenantId=tenantId;this.session=session;this.idempotencyKey=key;this.payloadHash=payloadHash;this.receiptNumber=receipt;this.customerId=customerId;this.subtotal=subtotal;this.taxCode=taxCode;this.taxRate=taxRate;this.taxTotal=taxTotal;this.total=subtotal.add(taxTotal);}
    @PrePersist void created(){postedAt=Instant.now();}
    public void voidSale(String key,String hash,String reason,UUID actor){if(!"POSTED".equals(status)||refundedTotal.signum()!=0)throw new IllegalArgumentException("Only an unrefunded posted sale can be voided");status="VOIDED";voidIdempotencyKey=key;voidPayloadHash=hash;voidReason=reason;voidedBy=actor;voidedAt=Instant.now();}
    public void addRefund(BigDecimal amount){if(amount.signum()<=0||amount.compareTo(total.subtract(refundedTotal))>0)throw new IllegalArgumentException("Refund exceeds the remaining sale balance");refundedTotal=refundedTotal.add(amount);status=refundedTotal.compareTo(total)==0?"REFUNDED":"PARTIAL_REFUND";}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PosRegisterSessionEntity getSession(){return session;} public String getIdempotencyKey(){return idempotencyKey;} public String getPayloadHash(){return payloadHash;} public String getReceiptNumber(){return receiptNumber;} public UUID getCustomerId(){return customerId;} public String getStatus(){return status;} public BigDecimal getSubtotal(){return subtotal;} public String getTaxCode(){return taxCode;} public BigDecimal getTaxRate(){return taxRate;} public BigDecimal getTaxTotal(){return taxTotal;} public BigDecimal getTotal(){return total;} public BigDecimal getRefundedTotal(){return refundedTotal;} public String getVoidIdempotencyKey(){return voidIdempotencyKey;} public String getVoidPayloadHash(){return voidPayloadHash;} public String getVoidReason(){return voidReason;} public UUID getVoidedBy(){return voidedBy;} public Instant getVoidedAt(){return voidedAt;} public Instant getPostedAt(){return postedAt;}
}
