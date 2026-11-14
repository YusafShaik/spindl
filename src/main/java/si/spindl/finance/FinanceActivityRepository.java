package si.spindl.finance;

import org.springframework.data.repository.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface FinanceActivityRepository extends Repository<InvoiceEntity,UUID> {
    @Query(value="""
        select activity.id as \"id\", activity.type as \"type\", activity.reference as \"reference\",
               activity.counterparty as \"counterparty\", activity.occurred_at as \"occurredAt\",
               activity.amount as \"amount\", activity.status as \"status\", activity.method as \"method\",
               activity.direction as \"direction\"
        from (
            select i.id, CAST('SALES_INVOICE' AS text) as type, CAST(i.invoice_number AS text) as reference,
                   CAST(c.name AS text) as counterparty, i.issued_at as occurred_at, i.total as amount,
                   CAST(i.status AS text) as status, CAST(NULL AS text) as method, CAST('RECEIVABLE' AS text) as direction
            from invoices i join customers c on c.id=i.customer_id
            where i.tenant_id=:tenantId
            union all
            select p.id, CAST('CUSTOMER_PAYMENT' AS text), CAST(coalesce(p.reference,i.invoice_number) AS text),
                   CAST(c.name AS text), p.received_at, p.amount, CAST('posted' AS text), CAST(p.method AS text), CAST('CASH_IN' AS text)
            from invoice_payments p join invoices i on i.id=p.invoice_id join customers c on c.id=i.customer_id
            where p.tenant_id=:tenantId
            union all
            select b.id, CAST('SUPPLIER_BILL' AS text), CAST(b.bill_number AS text), CAST(s.name AS text), b.issued_at,
                   b.total, CAST(b.status AS text), CAST(NULL AS text), CAST('PAYABLE' AS text)
            from supplier_bills b join suppliers s on s.id=b.supplier_id
            where b.tenant_id=:tenantId
            union all
            select p.id, CAST('SUPPLIER_PAYMENT' AS text), CAST(coalesce(p.reference,b.bill_number) AS text),
                   CAST(s.name AS text), p.paid_at, p.amount, CAST('posted' AS text), CAST(p.method AS text), CAST('CASH_OUT' AS text)
            from supplier_bill_payments p join supplier_bills b on b.id=p.supplier_bill_id join suppliers s on s.id=b.supplier_id
            where p.tenant_id=:tenantId
            union all
            select n.id, CAST('SUPPLIER_CREDIT' AS text), CAST(n.credit_number AS text), CAST(s.name AS text),
                   n.issued_at, n.total, CAST('posted' AS text), CAST(NULL AS text), CAST('CREDIT' AS text)
            from supplier_credit_notes n join supplier_bills b on b.id=n.supplier_bill_id join suppliers s on s.id=b.supplier_id
            where n.tenant_id=:tenantId
            union all
            select n.id, CAST('CUSTOMER_CREDIT' AS text), CAST(n.credit_number AS text), CAST(c.name AS text),
                   n.issued_at, n.total, CAST('posted' AS text), CAST(NULL AS text), CAST('CREDIT' AS text)
            from customer_credit_notes n join invoices i on i.id=n.invoice_id join customers c on c.id=i.customer_id
            where n.tenant_id=:tenantId
            union all
            select r.id, CAST('CUSTOMER_REFUND' AS text), CAST(coalesce(r.reference,n.credit_number) AS text), CAST(c.name AS text),
                   r.refunded_at, r.amount, CAST('posted' AS text), CAST(r.method AS text), CAST('CASH_OUT' AS text)
            from customer_credit_refunds r join customer_credit_notes n on n.id=r.credit_note_id
                 join invoices i on i.id=n.invoice_id join customers c on c.id=i.customer_id
            where r.tenant_id=:tenantId
        ) activity
        order by activity.occurred_at desc
        limit 500
        """,nativeQuery=true)
    List<FinanceActivityRow> findRecentByTenantId(@Param("tenantId") UUID tenantId);
}
