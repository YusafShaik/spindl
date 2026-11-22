package si.spindl.finance;

import si.spindl.common.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.purchasing.SupplierBillRepository;
import si.spindl.tenant.CurrentTenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import si.spindl.finance.OperationalReportDtos.AgingRow;

@Service
public class OperationalReportService {
    private final CurrentTenant tenant;private final InvoiceRepository invoices;private final SupplierBillRepository bills;
    public OperationalReportService(CurrentTenant tenant,InvoiceRepository invoices,SupplierBillRepository bills){this.tenant=tenant;this.invoices=invoices;this.bills=bills;}

    @Transactional(readOnly=true)
    public List<AgingRow> receivables(LocalDate dueFrom,LocalDate dueTo){validate(dueFrom,dueTo);LocalDate today=LocalDate.now();return invoices.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().filter(invoice->invoice.getBalance().signum()>0).filter(invoice->dueFrom==null||!invoice.getDueDate().isBefore(dueFrom)).filter(invoice->dueTo==null||!invoice.getDueDate().isAfter(dueTo)).map(invoice->new AgingRow(invoice.getInvoiceNumber(),invoice.getCustomer().getName(),invoice.getDueDate(),invoice.getTotal(),invoice.getAmountPaid().add(invoice.getCreditTotal()),invoice.getBalance(),bucket(invoice.getDueDate(),today))).toList();}

    @Transactional(readOnly=true)
    public List<AgingRow> payables(LocalDate dueFrom,LocalDate dueTo){validate(dueFrom,dueTo);LocalDate today=LocalDate.now();return bills.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().filter(bill->bill.getBalance().signum()>0).filter(bill->dueFrom==null||!bill.getDueDate().isBefore(dueFrom)).filter(bill->dueTo==null||!bill.getDueDate().isAfter(dueTo)).map(bill->new AgingRow(bill.getBillNumber(),bill.getSupplier().getName(),bill.getDueDate(),bill.getTotal(),bill.getAmountPaid().add(bill.getAmountCredited()),bill.getBalance(),bucket(bill.getDueDate(),today))).toList();}

    public String exportReceivables(LocalDate from,LocalDate to){return csv(receivables(from,to));}
    public String exportPayables(LocalDate from,LocalDate to){return csv(payables(from,to));}
    private String bucket(LocalDate dueDate,LocalDate today){long overdue=java.time.temporal.ChronoUnit.DAYS.between(dueDate,today);if(overdue<0)return "NOT_DUE";if(overdue==0)return "DUE_TODAY";if(overdue<=30)return "1-30_DAYS";if(overdue<=60)return "31-60_DAYS";if(overdue<=90)return "61-90_DAYS";return "OVER_90_DAYS";}
    private void validate(LocalDate from,LocalDate to){if(from!=null&&to!=null&&from.isAfter(to))throw new BadRequestException("From date must not be after the due date filter");}
    private String csv(List<AgingRow> rows){String header="reference,counterparty,due_date,age_bucket,original_amount,paid_or_credited,balance\r\n";return header+rows.stream().map(row->String.join(",",cell(row.reference()),cell(row.counterparty()),row.dueDate().toString(),row.ageBucket(),row.originalAmount().toPlainString(),row.paidOrCredited().toPlainString(),row.balance().toPlainString())).collect(java.util.stream.Collectors.joining("\r\n"));}
    private String cell(String value){String safe=value==null?"":value.replaceAll("^[\\s]*([=+@-])","'$1");return "\""+safe.replace("\"","\"\"")+"\"";}
}
