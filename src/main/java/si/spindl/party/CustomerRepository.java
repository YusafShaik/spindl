package si.spindl.party;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<CustomerEntity, UUID> {
    List<CustomerEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId);
    List<CustomerEntity> findAllByTenantIdAndCreatedByAndActiveTrueOrderByName(UUID tenantId, UUID createdBy);
    Page<CustomerEntity> findAllByTenantIdAndActiveTrueOrderByName(UUID tenantId,Pageable pageable);
    Optional<CustomerEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId, String code);
    java.util.Optional<CustomerEntity> findFirstByTenantIdAndEmailIgnoreCase(UUID tenantId,String email);
    long countByTenantIdAndActiveTrue(UUID tenantId);

    @org.springframework.data.jpa.repository.Query(value="""
        SELECT to_char(event_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAt", event_type AS "eventType", reference, status, amount
        FROM (
          SELECT q.created_at event_at,'QUOTE' event_type,q.quote_number reference,q.status,coalesce(sum(ql.quantity*ql.unit_price),0) amount
          FROM sales_quotes q LEFT JOIN sales_quote_lines ql ON ql.tenant_id=q.tenant_id AND ql.quote_id=q.id
          WHERE q.tenant_id=:tenantId AND q.customer_id=:customerId GROUP BY q.id
          UNION ALL
          SELECT so.created_at,'SALES_ORDER',so.order_number,so.status,coalesce(sum(sol.quantity*sol.unit_price),0)
          FROM sales_orders so LEFT JOIN sales_order_lines sol ON sol.tenant_id=so.tenant_id AND sol.sales_order_id=so.id
          WHERE so.tenant_id=:tenantId AND so.customer_id=:customerId GROUP BY so.id
          UNION ALL
          SELECT i.issued_at,'INVOICE',i.invoice_number,i.status,i.total FROM invoices i WHERE i.tenant_id=:tenantId AND i.customer_id=:customerId
          UNION ALL
          SELECT p.received_at,'PAYMENT',i.invoice_number,p.method,p.amount FROM invoice_payments p JOIN invoices i ON i.tenant_id=p.tenant_id AND i.id=p.invoice_id WHERE p.tenant_id=:tenantId AND i.customer_id=:customerId
          UNION ALL
          SELECT n.issued_at,'CUSTOMER_RETURN',n.credit_number,n.reason,n.total FROM customer_credit_notes n JOIN invoices i ON i.tenant_id=n.tenant_id AND i.id=n.invoice_id WHERE n.tenant_id=:tenantId AND i.customer_id=:customerId
        ) activity ORDER BY event_at DESC LIMIT 200
        """,nativeQuery=true)
    List<CustomerTimelineRow> findTimeline(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,@org.springframework.data.repository.query.Param("customerId") UUID customerId);
    interface CustomerTimelineRow { String getOccurredAt(); String getEventType(); String getReference(); String getStatus(); java.math.BigDecimal getAmount(); }
    List<CustomerEntity> findAllByTenantIdAndEmailIgnoreCaseAndActiveTrue(UUID tenantId,String email);
    List<CustomerEntity> findAllByTenantIdAndPhoneAndActiveTrue(UUID tenantId,String phone);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from CustomerEntity c where c.tenantId=:tenantId and c.id=:id")
    Optional<CustomerEntity> findForUpdate(@org.springframework.data.repository.query.Param("tenantId") UUID tenantId,@org.springframework.data.repository.query.Param("id") UUID id);
}
