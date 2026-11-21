package si.spindl.finance;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.party.CustomerEntity;
import si.spindl.sales.SalesOrderEntity;
import si.spindl.sales.SalesOrderLineEntity;
import si.spindl.sales.SalesOrderRepository;
import si.spindl.tenant.DevelopmentTenant;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantWebhookService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import static si.spindl.finance.InvoiceDtos.*;

@Service
public class InvoiceService {
    private static final Set<String> PAYMENT_METHODS = Set.of("CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE");
    private final InvoiceRepository invoices;
    private final SalesOrderRepository orders;
    private final DevelopmentTenant tenant;
    private final TenantFinanceSettingsRepository financeSettings;
    private final TenantAuditEventRepository audit;
    private final TenantWebhookService webhooks;

    public InvoiceService(InvoiceRepository invoices, SalesOrderRepository orders, DevelopmentTenant tenant,TenantFinanceSettingsRepository financeSettings,TenantAuditEventRepository audit,TenantWebhookService webhooks) {
        this.invoices = invoices;
        this.orders = orders;
        this.tenant = tenant;
        this.financeSettings=financeSettings;this.audit=audit;
        this.webhooks=webhooks;
    }

    @Transactional(readOnly=true)
    public List<InvoiceView> list() {
        return invoices.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().map(InvoiceView::from).toList();
    }

    @Transactional
    public InvoiceView issue(UUID orderId, IssueRequest request) {
        UUID tenantId = tenant.currentTenantId();
        SalesOrderEntity order = orders.findForUpdateByTenantIdAndId(tenantId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        InvoiceEntity prior = invoices.findByTenantIdAndIdempotencyKey(tenantId, request.idempotencyKey()).orElse(null);
        if (prior != null) {
            if (!prior.getSalesOrder().getId().equals(orderId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency key was used for another sales order");
            return InvoiceView.from(prior);
        }
        List<SalesOrderLineEntity> billable = order.getLines().stream().filter(line -> line.getInvoiceableQuantity() > 0).toList();
        if (billable.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "There are no shipped quantities left to invoice");
        TenantFinanceSettingsEntity settings=financeSettings.findForUpdate(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Finance settings are not configured"));
        BigDecimal taxRate=settings.getTaxRate();
        BigDecimal subtotal=billable.stream().map(line -> line.getUnitPrice().multiply(BigDecimal.valueOf(line.getInvoiceableQuantity())).setScale(2,java.math.RoundingMode.HALF_UP)).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxTotal=billable.stream().map(line->line.getUnitPrice().multiply(BigDecimal.valueOf(line.getInvoiceableQuantity())).setScale(2,java.math.RoundingMode.HALF_UP).multiply(taxRate).movePointLeft(2).setScale(2,java.math.RoundingMode.HALF_UP)).reduce(BigDecimal.ZERO,BigDecimal::add);
        LocalDate dueDate = request.dueDate() == null ? LocalDate.now().plusDays(30) : request.dueDate();
        InvoiceEntity invoice = new InvoiceEntity(tenantId, settings.allocateInvoiceNumber(), order, order.getCustomer(), request.idempotencyKey(), dueDate, subtotal,settings.getTaxCode(),taxRate,taxTotal);
        billable.forEach(line -> {
            int quantity = line.getInvoiceableQuantity();
            line.invoiceShippedQuantity(quantity);
            invoice.addLine(tenantId, line, quantity,taxRate);
        });
        try {
            InvoiceEntity saved=invoices.saveAndFlush(invoice);webhooks.enqueue(tenantId,"INVOICE_ISSUED",java.util.Map.of("invoiceId",saved.getId().toString(),"invoiceNumber",saved.getInvoiceNumber(),"customerId",saved.getCustomer().getId().toString(),"salesOrderId",orderId.toString(),"total",saved.getTotal()));return InvoiceView.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invoice request already exists; retry with its idempotency key");
        }
    }

    @Transactional
    public InvoiceView recordPayment(UUID invoiceId, PaymentRequest request) {
        UUID tenantId = tenant.currentTenantId();
        InvoiceEntity invoice = invoices.findForUpdateByTenantIdAndId(tenantId, invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String method = request.method().trim().toUpperCase(Locale.ROOT);
        if (!PAYMENT_METHODS.contains(method)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method must be cash, UPI, bank_transfer, card, or cheque");
        InvoicePaymentEntity paymentWithKey = invoices.findPaymentByTenantAndIdempotencyKey(tenantId, request.idempotencyKey()).orElse(null);
        if (paymentWithKey != null) {
            if (!paymentWithKey.matches(invoiceId, request.amount(), method, request.reference()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency key was reused with different payment details");
            return InvoiceView.from(invoice);
        }
        InvoicePaymentEntity existingPayment = invoice.getPayments().stream()
                .filter(payment -> request.idempotencyKey().equals(payment.getIdempotencyKey())).findFirst().orElse(null);
        if (existingPayment != null) {
            if (!existingPayment.matches(invoiceId, request.amount(), method, request.reference()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency key was reused with different payment details");
            return InvoiceView.from(invoice);
        }
        if (request.amount().signum() <= 0 || request.amount().compareTo(invoice.getBalance()) > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment must be positive and cannot exceed the remaining balance");
        invoice.recordPayment(request.amount());
        InvoicePaymentEntity payment = new InvoicePaymentEntity(tenantId, invoice, request.idempotencyKey(), request.amount(), method, request.reference());
        invoice.addPayment(payment);
        try {
            invoices.saveAndFlush(invoice);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment request already exists; retry with its idempotency key");
        }
        webhooks.enqueue(tenantId,"INVOICE_PAYMENT_RECORDED",java.util.Map.of("invoiceId",invoice.getId().toString(),"invoiceNumber",invoice.getInvoiceNumber(),"amount",request.amount(),"method",method,"balance",invoice.getBalance()));
        return InvoiceView.from(invoice);
    }

    @Transactional(readOnly=true)
    public FinanceSettingsView settings(){var value=financeSettings.findById(tenant.currentTenantId()).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Finance settings are not configured"));return new FinanceSettingsView(value.getTaxCode(),value.getTaxRate(),value.getInvoicePrefix(),value.getNextInvoiceNumber());}

    @Transactional
    public FinanceSettingsView updateSettings(UUID actorId,FinanceSettingsUpdateRequest request){String code=request.taxCode().trim().toUpperCase(Locale.ROOT);String prefix=request.invoicePrefix().trim().toUpperCase(Locale.ROOT);BigDecimal rate=request.taxRate().setScale(2,java.math.RoundingMode.HALF_UP);if(code.equals("NONE")&&rate.signum()!=0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tax rate must be zero when tax code is NONE");UUID tenantId=tenant.currentTenantId();TenantFinanceSettingsEntity settings=financeSettings.findForUpdate(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Finance settings are not configured"));String previousCode=settings.getTaxCode();BigDecimal previousRate=settings.getTaxRate();String previousPrefix=settings.getInvoicePrefix();settings.update(code,rate,prefix);audit.save(new TenantAuditEventEntity(tenantId,actorId,"FINANCE_SETTINGS_UPDATED","tenant_finance_settings",tenantId,java.util.Map.of("previousTaxCode",previousCode,"taxCode",code,"taxRate",rate,"invoicePrefix",prefix,"previousInvoicePrefix",previousPrefix)));return new FinanceSettingsView(code,rate,prefix,settings.getNextInvoiceNumber());}

    @Transactional(readOnly=true)
    public List<TaxSummaryView> taxSummary(LocalDate from,LocalDate to){if(from!=null&&to!=null&&from.isAfter(to))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"From date must not be after to date");Instant start=from==null?null:from.atStartOfDay().toInstant(ZoneOffset.UTC);Instant until=to==null?null:to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);return invoices.taxSummary(tenant.currentTenantId(),start,until).stream().map(row->new TaxSummaryView(row.getPeriod(),row.getTaxCode(),row.getTaxRate(),row.getSubtotal(),row.getTaxAmount(),row.getGrossTotal())).toList();}

    @Transactional(readOnly=true)
    public String exportTaxSummary(LocalDate from,LocalDate to){String rows=taxSummary(from,to).stream().map(row->String.join(",",row.period(),csv(row.taxCode()),row.taxRate().toPlainString(),row.subtotal().toPlainString(),row.taxAmount().toPlainString(),row.grossTotal().toPlainString())).collect(java.util.stream.Collectors.joining("\r\n"));return "period,tax_code,tax_rate,subtotal,tax_amount,gross_total\r\n"+rows;}

    private String csv(String value){return "\""+value.replace("\"","\"\"")+"\"";}

    public record FinanceSettingsView(String taxCode,BigDecimal taxRate,String invoicePrefix,long nextInvoiceNumber){}
    public record TaxSummaryView(String period,String taxCode,BigDecimal taxRate,BigDecimal subtotal,BigDecimal taxAmount,BigDecimal grossTotal){}

    @Transactional
    public int reassignCustomer(UUID tenantId, UUID sourceId, si.spindl.party.CustomerEntity target) {
        return invoices.reassignCustomer(tenantId, sourceId, target);
    }
}
