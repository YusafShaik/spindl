package si.spindl.pos;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="pos_register_sessions")
public class PosRegisterSessionEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="register_id",nullable=false) private PosRegisterEntity register;
    @Column(name="cashier_user_id",nullable=false) private UUID cashierUserId;
    @Column(nullable=false,length=16) private String status="OPEN";
    @Column(name="opening_float",nullable=false,precision=14,scale=2) private BigDecimal openingFloat;
    @Column(name="expected_cash",precision=14,scale=2) private BigDecimal expectedCash;
    @Column(name="counted_cash",precision=14,scale=2) private BigDecimal countedCash;
    @Column(name="cash_variance",precision=14,scale=2) private BigDecimal cashVariance;
    @Column(name="opened_at",nullable=false,updatable=false) private Instant openedAt;
    @Column(name="closed_at") private Instant closedAt;
    protected PosRegisterSessionEntity(){}
    public PosRegisterSessionEntity(UUID tenantId,PosRegisterEntity register,UUID cashierUserId,BigDecimal openingFloat){this.tenantId=tenantId;this.register=register;this.cashierUserId=cashierUserId;this.openingFloat=openingFloat;}
    @PrePersist void created(){openedAt=Instant.now();}
    public void close(BigDecimal expected,BigDecimal counted){if(!"OPEN".equals(status))throw new IllegalStateException("Session is not open");status="CLOSED";expectedCash=expected;countedCash=counted;cashVariance=counted.subtract(expected);closedAt=Instant.now();}
    public UUID getId(){return id;} public UUID getTenantId(){return tenantId;} public PosRegisterEntity getRegister(){return register;} public UUID getCashierUserId(){return cashierUserId;} public String getStatus(){return status;} public BigDecimal getOpeningFloat(){return openingFloat;} public BigDecimal getExpectedCash(){return expectedCash;} public BigDecimal getCountedCash(){return countedCash;} public BigDecimal getCashVariance(){return cashVariance;} public Instant getOpenedAt(){return openedAt;} public Instant getClosedAt(){return closedAt;}
}
