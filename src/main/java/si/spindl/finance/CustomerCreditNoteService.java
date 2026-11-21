package si.spindl.finance;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantWebhookService;
import si.spindl.quality.QualityLotEntity;
import si.spindl.quality.QualityLotRepository;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Year;
import java.util.*;

import static si.spindl.finance.CustomerCreditNoteDtos.*;

@Service
public class CustomerCreditNoteService {
    private static final Set<String> DISPOSITIONS=Set.of("RESTOCK","QUARANTINE","SCRAP");
    private static final Set<String> METHODS=Set.of("CASH","UPI","BANK_TRANSFER","CARD","CHEQUE");
    private final DevelopmentTenant tenant;
    private final InvoiceRepository invoices;
    private final CustomerCreditNoteRepository notes;
    private final CustomerCreditRefundRepository refunds;
    private final ItemRepository items;
    private final WarehouseStockRepository stock;
    private final InventoryMovementRepository movements;
    private final QualityLotRepository qualityLots;
    private final TenantAuditEventRepository audit;
    private final TenantWebhookService webhooks;

    public CustomerCreditNoteService(DevelopmentTenant tenant,InvoiceRepository invoices,CustomerCreditNoteRepository notes,CustomerCreditRefundRepository refunds,ItemRepository items,WarehouseStockRepository stock,InventoryMovementRepository movements,QualityLotRepository qualityLots,TenantAuditEventRepository audit,TenantWebhookService webhooks){this.tenant=tenant;this.invoices=invoices;this.notes=notes;this.refunds=refunds;this.items=items;this.stock=stock;this.movements=movements;this.qualityLots=qualityLots;this.audit=audit;this.webhooks=webhooks;}

    @Transactional(readOnly=true)
    public List<CreditNoteView> list(){return notes.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().map(CreditNoteView::from).toList();}

    @Transactional(readOnly=true)
    public CreditNoteView get(UUID id){return notes.findByTenantIdAndId(tenant.currentTenantId(),id).map(CreditNoteView::from).orElseThrow(()->notFound("Credit note not found"));}

    @Transactional
    public CreditNoteView create(UUID actorId,UUID invoiceId,CreateCreditRequest request){
        UUID tenantId=tenant.currentTenantId();
        InvoiceEntity invoice=invoices.findForUpdateByTenantIdAndId(tenantId,invoiceId).orElseThrow(()->notFound("Invoice not found"));
        String reason=request.reason().trim();
        if(reason.isEmpty())throw badRequest("A return reason is required");
        List<NormalizedLine> lines=normalize(request.lines());
        String hash=hash(reason+"\n"+lines.stream().map(line->line.invoiceLineId+":"+line.quantity+":"+line.disposition).reduce((a,b)->a+"\n"+b).orElse(""));
        CustomerCreditNoteEntity prior=notes.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(invoiceId,hash))throw conflict("Idempotency key was reused with different credit details");return CreditNoteView.from(prior);}

        Map<UUID,InvoiceLineEntity> invoiceLines=new HashMap<>();invoice.getLines().forEach(line->invoiceLines.put(line.getId(),line));
        BigDecimal subtotal=BigDecimal.ZERO,taxTotal=BigDecimal.ZERO;
        List<PreparedLine> prepared=new ArrayList<>();
        for(NormalizedLine input:lines){
            InvoiceLineEntity line=invoiceLines.get(input.invoiceLineId);
            if(line==null)throw badRequest("Every returned line must belong to the selected invoice");
            if(input.quantity>line.getCreditEligibleQuantity())throw conflict("Return quantity exceeds the uninvolved invoice quantity for "+line.getSku());
            BigDecimal base=line.getUnitPrice().multiply(BigDecimal.valueOf(input.quantity)).setScale(2,java.math.RoundingMode.HALF_UP);
            BigDecimal tax=line.taxAmountForCredit(input.quantity);
            subtotal=subtotal.add(base);taxTotal=taxTotal.add(tax);
            prepared.add(new PreparedLine(line,input,base,tax,base.add(tax)));
        }
        BigDecimal total=subtotal.add(taxTotal).setScale(2,java.math.RoundingMode.HALF_UP);
        if(total.signum()<=0||total.compareTo(invoice.getAvailableCredit())>0)throw conflict("Credit exceeds the remaining invoice amount");
        BigDecimal refundDue=total.subtract(invoice.getBalance()).max(BigDecimal.ZERO).min(total);
        String creditNumber="CN-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        CustomerCreditNoteEntity note=new CustomerCreditNoteEntity(tenantId,invoice,creditNumber,request.idempotencyKey(),hash,reason,subtotal,taxTotal,total,refundDue);
        for(PreparedLine value:prepared){
            InvoiceLineEntity line=value.invoiceLine;ItemEntity item=items.findForUpdate(tenantId,line.getSalesOrderLine().getItem().getId()).orElseThrow(()->conflict("An item on this invoice no longer exists"));
            WarehouseEntity warehouse=line.getSalesOrderLine().getWarehouse();
            WarehouseStockEntity balance=stock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->conflict("Warehouse stock balance is missing for "+item.getSku()));
            int qty=value.input.quantity;
            try{
                if(value.input.disposition.equals("RESTOCK")){item.receiveStock(qty);balance.receiveStock(qty);}
                else if(value.input.disposition.equals("QUARANTINE")){item.receiveStockForQuality(qty);balance.receiveStock(qty);balance.addQualityHold(qty);qualityLots.save(new QualityLotEntity(tenantId,item,warehouse,"CUSTOMER_RETURN",creditNumber+"/"+line.getId(),qty));}
                line.credit(qty,value.tax);
            }catch(IllegalArgumentException|ArithmeticException exception){throw conflict(exception.getMessage());}
            note.addLine(line,qty,value.input.disposition,value.subtotal,value.tax,value.total);
            if(!value.input.disposition.equals("SCRAP"))movements.save(new InventoryMovementEntity(tenantId,item,warehouse,qty,"Customer return - "+value.input.disposition,creditNumber,creditNumber+":"+line.getId()));
        }
        try{invoice.recordCredit(total);CustomerCreditNoteEntity saved=notes.saveAndFlush(note);audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOMER_CREDIT_NOTE_ISSUED","customer_credit_note",saved.getId(),Map.of("creditNumber",creditNumber,"invoiceNumber",invoice.getInvoiceNumber(),"total",total,"refundDue",refundDue,"reason",reason)));webhooks.enqueue(tenantId,"CUSTOMER_CREDIT_NOTE_ISSUED",Map.of("creditNoteId",saved.getId().toString(),"creditNumber",creditNumber,"invoiceId",invoice.getId().toString(),"invoiceNumber",invoice.getInvoiceNumber(),"total",total,"refundDue",refundDue));return CreditNoteView.from(saved);}
        catch(DataIntegrityViolationException exception){throw conflict("Credit request already exists; retry with its idempotency key");}
        catch(IllegalArgumentException exception){throw conflict(exception.getMessage());}
    }

    @Transactional
    public CreditNoteView refund(UUID actorId,UUID noteId,RefundRequest request){
        UUID tenantId=tenant.currentTenantId();CustomerCreditNoteEntity note=notes.findForUpdate(tenantId,noteId).orElseThrow(()->notFound("Credit note not found"));
        String method=request.method().trim().toUpperCase(Locale.ROOT);if(!METHODS.contains(method))throw badRequest("Refund method must be cash, UPI, bank_transfer, card, or cheque");
        BigDecimal amount;try{amount=request.amount().setScale(2,java.math.RoundingMode.UNNECESSARY);}catch(ArithmeticException exception){throw badRequest("Refund amount must have no more than two decimal places");}
        String reference=request.reference()==null||request.reference().isBlank()?null:request.reference().trim();
        CustomerCreditRefundEntity prior=refunds.findByTenantIdAndNoteAndIdempotencyKey(tenantId,noteId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(noteId,amount,method,reference))throw conflict("Idempotency key was reused with different refund details");return CreditNoteView.from(notes.findByTenantIdAndId(tenantId,noteId).orElse(note));}
        if(amount.signum()<=0||amount.compareTo(note.getRefundBalance())>0)throw conflict("Refund must be positive and cannot exceed the remaining refund due");
        try{CustomerCreditRefundEntity refund=new CustomerCreditRefundEntity(tenantId,note,request.idempotencyKey(),amount,method,reference);note.addRefund(refund);refunds.save(refund);notes.saveAndFlush(note);audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOMER_CREDIT_REFUNDED","customer_credit_note",noteId,Map.of("creditNumber",note.getCreditNumber(),"amount",amount,"method",method)));return CreditNoteView.from(notes.findByTenantIdAndId(tenantId,noteId).orElse(note));}
        catch(DataIntegrityViolationException exception){throw conflict("Refund request already exists; retry with its idempotency key");}
    }

    private List<NormalizedLine> normalize(List<CreditLineRequest> inputs){if(inputs==null||inputs.isEmpty())throw badRequest("At least one invoice line is required");Set<UUID> seen=new HashSet<>();List<NormalizedLine> result=new ArrayList<>();for(CreditLineRequest input:inputs){String disposition=input.disposition().trim().toUpperCase(Locale.ROOT);if(!DISPOSITIONS.contains(disposition))throw badRequest("Disposition must be RESTOCK, QUARANTINE, or SCRAP");if(!seen.add(input.invoiceLineId()))throw badRequest("Each invoice line can appear only once per credit note");result.add(new NormalizedLine(input.invoiceLineId(),input.quantity(),disposition));}result.sort(Comparator.comparing(line->line.invoiceLineId.toString()));return result;}
    private String hash(String input){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));}catch(Exception exception){throw new IllegalStateException(exception);}}
    private ResponseStatusException notFound(String message){return new ResponseStatusException(HttpStatus.NOT_FOUND,message);}
    private ResponseStatusException badRequest(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
    private record NormalizedLine(UUID invoiceLineId,int quantity,String disposition){}
    private record PreparedLine(InvoiceLineEntity invoiceLine,NormalizedLine input,BigDecimal subtotal,BigDecimal tax,BigDecimal total){}
}
