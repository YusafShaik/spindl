package si.spindl.purchasing;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplierBillRepository extends JpaRepository<SupplierBillEntity,UUID> {
    @EntityGraph(attributePaths={"supplier","purchaseOrder","lines"})
    List<SupplierBillEntity> findAllByTenantIdOrderByIssuedAtDesc(UUID tenantId);
    Optional<SupplierBillEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @EntityGraph(attributePaths={"supplier","purchaseOrder","lines","lines.purchaseOrderLine","lines.purchaseOrderLine.item"})
    Optional<SupplierBillEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SupplierBillEntity b where b.tenantId=:tenantId and b.id=:id")
    Optional<SupplierBillEntity> findForUpdateByTenantIdAndId(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @Query("select p from SupplierBillPaymentEntity p where p.tenantId=:tenantId and p.idempotencyKey=:key")
    Optional<SupplierBillPaymentEntity> findPaymentByTenantAndIdempotencyKey(@Param("tenantId") UUID tenantId,@Param("key") String key);
    @Query("select coalesce(sum(b.total-b.amountPaid-b.amountCredited),0) from SupplierBillEntity b where b.tenantId=:tenantId and b.status not in ('paid','credited','settled')")
    BigDecimal outstandingPayables(@Param("tenantId") UUID tenantId);

    @Query("select coalesce(sum(b.total-b.amountPaid-b.amountCredited),0) from SupplierBillEntity b where b.tenantId=:tenantId and b.status not in ('paid','credited','settled') and b.dueDate<:today")
    BigDecimal overduePayables(@Param("tenantId") UUID tenantId,@Param("today") java.time.LocalDate today);

    @Query(value="select to_char(date_trunc('month',issued_at),'YYYY-MM') as \"period\",sum(total) as \"amount\" from supplier_bills where tenant_id=:tenantId and issued_at>=:fromTime and issued_at<:untilTime group by date_trunc('month',issued_at)", nativeQuery=true)
    List<MonthlyAmountRow> monthlyBilled(@Param("tenantId") UUID tenantId,@Param("fromTime") java.time.Instant fromTime,@Param("untilTime") java.time.Instant untilTime);

    interface MonthlyAmountRow { String getPeriod(); BigDecimal getAmount(); }
}
