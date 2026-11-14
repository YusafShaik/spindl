package si.spindl.sales;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalesQuoteRepository extends JpaRepository<SalesQuoteEntity,UUID> {
    long countByTenantId(UUID tenantId);
    @EntityGraph(attributePaths={"customer","lines","lines.item"})
    List<SalesQuoteEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"customer","lines","lines.item"})
    Optional<SalesQuoteEntity> findByTenantIdAndId(UUID tenantId,UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from SalesQuoteEntity q where q.tenantId=:tenantId and q.id=:id")
    Optional<SalesQuoteEntity> findForUpdateByTenantIdAndId(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    @org.springframework.data.jpa.repository.Modifying
    @Query("update SalesQuoteEntity q set q.customer=:target where q.tenantId=:tenantId and q.customer.id=:sourceId")
    int reassignCustomer(@Param("tenantId") UUID tenantId,@Param("sourceId") UUID sourceId,@Param("target") si.spindl.party.CustomerEntity target);
}
