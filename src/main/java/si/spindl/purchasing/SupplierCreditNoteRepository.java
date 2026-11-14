package si.spindl.purchasing;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplierCreditNoteRepository extends JpaRepository<SupplierCreditNoteEntity,UUID> {
    @EntityGraph(attributePaths={"bill","bill.supplier","purchaseOrder"})
    List<SupplierCreditNoteEntity> findAllByTenantIdOrderByIssuedAtDesc(UUID tenantId);
    Optional<SupplierCreditNoteEntity> findByTenantIdAndIdempotencyKey(UUID tenantId,String idempotencyKey);
}
