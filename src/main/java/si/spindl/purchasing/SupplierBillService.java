package si.spindl.purchasing;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import static si.spindl.purchasing.SupplierBillDtos.*;

@Service
public class SupplierBillService {
    private static final Set<String> METHODS=Set.of("CASH","UPI","BANK_TRANSFER","CARD","CHEQUE");
    private final SupplierBillRepository bills;
    private final PurchaseOrderRepository orders;
    private final DevelopmentTenant tenant;
    public SupplierBillService(SupplierBillRepository bills,PurchaseOrderRepository orders,DevelopmentTenant tenant){this.bills=bills;this.orders=orders;this.tenant=tenant;}

    @Transactional(readOnly=true)
    public List<BillView> list(){return bills.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().map(BillView::from).toList();}

    @Transactional
    public BillView issue(UUID orderId,IssueRequest request){
        UUID tenantId=tenant.currentTenantId();
        PurchaseOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,orderId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        SupplierBillEntity prior=bills.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.getPurchaseOrder().getId().equals(orderId))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was used for another purchase order");return BillView.from(prior);}
        if(!order.getStatus().equals("received")&&!order.getStatus().equals("partially_received"))throw new ResponseStatusException(HttpStatus.CONFLICT,"Receive goods before creating a supplier bill");
        List<PurchaseOrderLineEntity> billable=order.getLines().stream().filter(line->line.getBillableQuantity()>0).toList();
        if(billable.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"There are no accepted quantities left to bill");
        BigDecimal total=billable.stream().map(line->line.getUnitPrice().multiply(BigDecimal.valueOf(line.getBillableQuantity()))).reduce(BigDecimal.ZERO,BigDecimal::add);
        LocalDate dueDate=request.dueDate()==null?LocalDate.now().plusDays(30):request.dueDate();
        String number="BILL-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        SupplierBillEntity bill=new SupplierBillEntity(tenantId,order.getSupplier(),order,number,request.idempotencyKey(),dueDate,total);
        billable.forEach(line->{int quantity=line.getBillableQuantity();line.billAccepted(quantity);bill.addLine(tenantId,line,quantity);});
        try{return BillView.from(bills.saveAndFlush(bill));}catch(DataIntegrityViolationException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"Bill request already exists; retry with its idempotency key");}
    }

    @Transactional
    public BillView pay(UUID billId,PaymentRequest request){
        UUID tenantId=tenant.currentTenantId();
        SupplierBillEntity bill=bills.findForUpdateByTenantIdAndId(tenantId,billId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        String method=request.method().trim().toUpperCase(Locale.ROOT);
        if(!METHODS.contains(method))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Payment method must be cash, UPI, bank_transfer, card, or cheque");
        SupplierBillPaymentEntity prior=bills.findPaymentByTenantAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(billId,request.amount(),method,request.reference()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was reused with different payment details");return BillView.from(bill);}
        if(request.amount().signum()<=0||request.amount().compareTo(bill.getBalance())>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Payment must be positive and cannot exceed the remaining balance");
        bill.recordPayment(request.amount());
        bill.addPayment(new SupplierBillPaymentEntity(tenantId,bill,request.idempotencyKey(),request.amount(),method,request.reference()));
        try{bills.saveAndFlush(bill);}catch(DataIntegrityViolationException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"Payment already posted; retry with its idempotency key");}
        return BillView.from(bill);
    }
}
