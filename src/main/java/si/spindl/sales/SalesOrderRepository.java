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
import java.util.Collection;

public interface SalesOrderRepository extends JpaRepository<SalesOrderEntity,UUID> {
    long countByTenantId(UUID tenantId);
    @EntityGraph(attributePaths={"customer","quote","lines","lines.item"})
    List<SalesOrderEntity> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);
    @EntityGraph(attributePaths={"customer","quote","lines","lines.item"})
    Optional<SalesOrderEntity> findByTenantIdAndQuoteId(UUID tenantId,UUID quoteId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from SalesOrderEntity o where o.tenantId=:tenantId and o.id=:id")
    Optional<SalesOrderEntity> findForUpdateByTenantIdAndId(@Param("tenantId") UUID tenantId,@Param("id") UUID id);
    long countByTenantIdAndCustomerId(UUID tenantId, UUID customerId);
    long countByTenantIdAndStatusIn(UUID tenantId, Collection<String> statuses);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update SalesOrderEntity o set o.customer=:target where o.tenantId=:tenantId and o.customer.id=:sourceId")
    int reassignCustomer(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,@org.springframework.data.repository.query.Param("sourceId") UUID sourceId,@org.springframework.data.repository.query.Param("target") si.spindl.party.CustomerEntity target);
}
