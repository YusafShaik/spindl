package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="pos_refunds",uniqueConstraints={@UniqueConstraint(name="uk_pos_refunds_tenant_id",columnNames={"tenant_id","id"}),@UniqueConstraint(name="uk_pos_refunds_tenant_idempotency",columnNames={"tenant_id","idempotency_key"}),@UniqueConstraint(name="uk_pos_refunds_tenant_number",columnNames={"tenant_id","refund_number"})})
public class PosRefundEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sale_id",nullable=false) private PosSaleEntity sale;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="session_id",nullable=false) private PosRegisterSessionEntity session;
    @Column(name="idempotency_key",nullable=false,length=120) private String idempotencyKey;
    @Column(name="payload_hash",nullable=false,length=64) private String payloadHash;
    @Column(name="refund_number",nullable=false,length=64) private String refundNumber;
    @Column(nullable=false,length=300) private String reason;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal subtotal;
    @Column(name="tax_total",nullable=false,precision=14,scale=2) private BigDecimal taxTotal;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal total;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected PosRefundEntity(){}
    public PosRefundEntity(UUID tenantId,PosSaleEntity sale,PosRegisterSessionEntity session,String key,String hash,String number,String reason,BigDecimal subtotal,BigDecimal taxTotal,UUID actor){this.tenantId=tenantId;this.sale=sale;this.session=session;this.idempotencyKey=key;this.payloadHash=hash;this.refundNumber=number;this.reason=reason;this.subtotal=subtotal;this.taxTotal=taxTotal;this.total=subtotal.add(taxTotal);this.createdBy=actor;}
    @PrePersist void created(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PosSaleEntity getSale(){return sale;} public PosRegisterSessionEntity getSession(){return session;} public String getIdempotencyKey(){return idempotencyKey;} public String getPayloadHash(){return payloadHash;} public String getRefundNumber(){return refundNumber;} public String getReason(){return reason;} public BigDecimal getSubtotal(){return subtotal;} public BigDecimal getTaxTotal(){return taxTotal;} public BigDecimal getTotal(){return total;} public UUID getCreatedBy(){return createdBy;} public Instant getCreatedAt(){return createdAt;}
}
