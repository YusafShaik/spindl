package si.spindl.finance;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {
    long countByTenantId(UUID tenantId);
    @EntityGraph(attributePaths={"customer", "salesOrder", "lines", "lines.salesOrderLine.item"})
    List<InvoiceEntity> findAllByTenantIdOrderByIssuedAtDesc(UUID tenantId);

    Optional<InvoiceEntity> findByTenantIdAndIdempotencyKey(UUID tenantId, String idempotencyKey);

    @Query("select p from InvoicePaymentEntity p where p.tenantId=:tenantId and p.idempotencyKey=:key")
    Optional<InvoicePaymentEntity> findPaymentByTenantAndIdempotencyKey(@Param("tenantId") UUID tenantId, @Param("key") String key);

    @EntityGraph(attributePaths={"customer", "salesOrder", "lines"})
    Optional<InvoiceEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InvoiceEntity i where i.tenantId=:tenantId and i.id=:id")
    Optional<InvoiceEntity> findForUpdateByTenantIdAndId(@Param("tenantId") UUID tenantId, @Param("id") UUID id);

    @Query("select coalesce(sum(greatest(i.total-i.amountPaid-i.creditTotal,0)), 0) from InvoiceEntity i where i.tenantId=:tenantId and i.customer.id=:customerId and i.status not in ('paid','credited')")
    BigDecimal outstandingForCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId);

    @Query("select i.customer.id, coalesce(sum(greatest(i.total-i.amountPaid-i.creditTotal,0)), 0) from InvoiceEntity i where i.tenantId=:tenantId and i.status not in ('paid','credited') group by i.customer.id")
    List<Object[]> outstandingGroupedByCustomer(@Param("tenantId") UUID tenantId);

    @Query("select coalesce(sum(greatest(i.total-i.amountPaid-i.creditTotal,0)),0) from InvoiceEntity i where i.tenantId=:tenantId and i.status not in ('paid','credited')")
    BigDecimal outstandingReceivables(@Param("tenantId") UUID tenantId);

    @Query("select coalesce(sum(greatest(i.total-i.amountPaid-i.creditTotal,0)),0) from InvoiceEntity i where i.tenantId=:tenantId and i.status not in ('paid','credited') and i.dueDate<:today")
    BigDecimal overdueReceivables(@Param("tenantId") UUID tenantId,@Param("today") java.time.LocalDate today);

    @Query("select coalesce(sum(i.total), 0) from InvoiceEntity i where i.tenantId=:tenantId and i.issuedAt >= :since")
    BigDecimal invoicedSince(@Param("tenantId") UUID tenantId, @Param("since") Instant since);

    @Query(value="select to_char(date_trunc('month',issued_at),'YYYY-MM') as \"period\",sum(total) as \"amount\" from invoices where tenant_id=:tenantId and issued_at>=:fromTime and issued_at<:untilTime group by date_trunc('month',issued_at)", nativeQuery=true)
    List<MonthlyAmountRow> monthlyInvoiced(@Param("tenantId") UUID tenantId,@Param("fromTime") Instant fromTime,@Param("untilTime") Instant untilTime);

    interface MonthlyAmountRow { String getPeriod(); BigDecimal getAmount(); }

    @Query(value="select to_char(date_trunc('month',i.issued_at),'YYYY-MM') as \"period\",i.tax_code as \"taxCode\",i.tax_rate as \"taxRate\",sum(i.subtotal-coalesce((select sum(n.subtotal) from customer_credit_notes n where n.tenant_id=i.tenant_id and n.invoice_id=i.id),0)) as \"subtotal\",sum(i.tax_total-coalesce((select sum(n.tax_total) from customer_credit_notes n where n.tenant_id=i.tenant_id and n.invoice_id=i.id),0)) as \"taxAmount\",sum(i.total-coalesce((select sum(n.total) from customer_credit_notes n where n.tenant_id=i.tenant_id and n.invoice_id=i.id),0)) as \"grossTotal\" from invoices i where i.tenant_id=:tenantId and (cast(:fromTime as timestamptz) is null or i.issued_at>=cast(:fromTime as timestamptz)) and (cast(:untilTime as timestamptz) is null or i.issued_at<cast(:untilTime as timestamptz)) group by date_trunc('month',i.issued_at),i.tax_code,i.tax_rate order by date_trunc('month',i.issued_at),i.tax_code,i.tax_rate",nativeQuery=true)
    List<TaxSummaryRow> taxSummary(@Param("tenantId") UUID tenantId,@Param("fromTime") Instant fromTime,@Param("untilTime") Instant untilTime);

    interface TaxSummaryRow { String getPeriod();String getTaxCode();BigDecimal getTaxRate();BigDecimal getSubtotal();BigDecimal getTaxAmount();BigDecimal getGrossTotal(); }
    @org.springframework.data.jpa.repository.Modifying
    @Query("update InvoiceEntity i set i.customer=:target where i.tenantId=:tenantId and i.customer.id=:sourceId")
    int reassignCustomer(@Param("tenantId") UUID tenantId,@Param("sourceId") UUID sourceId,@Param("target") si.spindl.party.CustomerEntity target);
}
