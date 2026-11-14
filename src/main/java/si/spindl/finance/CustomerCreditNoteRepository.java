package si.spindl.finance;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerCreditNoteRepository extends JpaRepository<CustomerCreditNoteEntity,UUID> {
    @EntityGraph(attributePaths={"invoice","invoice.customer","lines","lines.invoiceLine","lines.invoiceLine.salesOrderLine","lines.invoiceLine.salesOrderLine.item","lines.warehouse"})
    List<CustomerCreditNoteEntity> findAllByTenantIdOrderByIssuedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"invoice","invoice.customer","lines","lines.invoiceLine","lines.invoiceLine.salesOrderLine","lines.invoiceLine.salesOrderLine.item","lines.warehouse","refunds"})
    Optional<CustomerCreditNoteEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @EntityGraph(attributePaths={"invoice","invoice.customer","lines","lines.invoiceLine","lines.invoiceLine.salesOrderLine","lines.invoiceLine.salesOrderLine.item","lines.warehouse"})
    Optional<CustomerCreditNoteEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from CustomerCreditNoteEntity n where n.tenantId=:tenantId and n.id=:id")
    Optional<CustomerCreditNoteEntity> findForUpdate(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
}
