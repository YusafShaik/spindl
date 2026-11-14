package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name="pos_refund_tenders")
public class PosRefundTenderEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="refund_id",nullable=false) private PosRefundEntity refund;
    @Column(nullable=false,length=16) private String method;
    @Column(nullable=false,precision=14,scale=2) private BigDecimal amount;
    @Column(length=120) private String reference;
    protected PosRefundTenderEntity(){}
    public PosRefundTenderEntity(UUID tenantId,PosRefundEntity refund,String method,BigDecimal amount,String reference){this.tenantId=tenantId;this.refund=refund;this.method=method;this.amount=amount;this.reference=reference;}
    public String getMethod(){return method;} public BigDecimal getAmount(){return amount;} public String getReference(){return reference;}
}
