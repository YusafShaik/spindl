package si.spindl.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosSaleRepository extends JpaRepository<PosSaleEntity,UUID> {
    Optional<PosSaleEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @EntityGraph(attributePaths={"session","session.register","session.register.warehouse"})
    Optional<PosSaleEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"session","session.register","session.register.warehouse"})
    @Query("select s from PosSaleEntity s where s.tenantId=:tenantId and s.id=:id")
    Optional<PosSaleEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    List<PosSaleEntity> findAllByTenantIdAndSessionIdOrderByPostedAtDesc(UUID tenantId,UUID sessionId);
    @Query("select coalesce(sum(t.amount),0) from PosSaleTenderEntity t where t.tenantId=:tenantId and t.sale.session.id=:sessionId and t.sale.status<>'VOIDED' and t.method='CASH'")
    BigDecimal cashTenderedForSession(@Param("tenantId") UUID tenantId,@Param("sessionId") UUID sessionId);
    @Query("select coalesce(sum(t.amount),0) from PosRefundTenderEntity t where t.tenantId=:tenantId and t.refund.session.id=:sessionId and t.method='CASH'")
    BigDecimal cashRefundedForSession(@Param("tenantId") UUID tenantId,@Param("sessionId") UUID sessionId);
}
