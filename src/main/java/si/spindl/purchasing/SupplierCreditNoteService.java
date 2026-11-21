package si.spindl.purchasing;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.inventory.WarehouseRepository;
import si.spindl.inventory.WarehouseStockRepository;
import si.spindl.tenant.DevelopmentTenant;
import java.math.BigDecimal;
import java.time.Year;
import java.util.*;
import static si.spindl.purchasing.SupplierBillDtos.*;

@Service
public class SupplierCreditNoteService {
    private final SupplierCreditNoteRepository notes;
    private final SupplierBillRepository bills;
    private final PurchaseOrderRepository orders;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final DevelopmentTenant tenant;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    public SupplierCreditNoteService(SupplierCreditNoteRepository notes,SupplierBillRepository bills,PurchaseOrderRepository orders,ItemRepository items,InventoryMovementRepository movements,DevelopmentTenant tenant,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock){this.notes=notes;this.bills=bills;this.orders=orders;this.items=items;this.movements=movements;this.tenant=tenant;this.warehouses=warehouses;this.warehouseStock=warehouseStock;}

    @Transactional(readOnly=true)
    public List<CreditNoteView> list(){return notes.findAllByTenantIdOrderByIssuedAtDesc(tenant.currentTenantId()).stream().map(CreditNoteView::from).toList();}

    @Transactional
    public CreditNoteView credit(UUID billId,CreditRequest request){
        UUID tenantId=tenant.currentTenantId();
        if(request.lines().stream().map(CreditLine::supplierBillLineId).distinct().count()!=request.lines().size())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A bill line can only be credited once per credit note");
        SupplierBillEntity snapshot=bills.findByTenantIdAndId(tenantId,billId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        PurchaseOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,snapshot.getPurchaseOrder().getId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        SupplierBillEntity bill=bills.findForUpdateByTenantIdAndId(tenantId,billId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        String reason=request.reason().trim();
        SupplierCreditNoteEntity prior=notes.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(billId,reason,request.lines()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was reused with different credit details");return CreditNoteView.from(prior);}
        Map<UUID,SupplierBillLineEntity> billLines=new HashMap<>();bill.getLines().forEach(line->billLines.put(line.getId(),line));
        List<CreditLine> requested=new ArrayList<>(request.lines());
        BigDecimal total=BigDecimal.ZERO;
        for(CreditLine input:requested){
            SupplierBillLineEntity line=billLines.get(input.supplierBillLineId());
            if(line==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Credit contains a line outside this supplier bill");
            if(input.quantity()>line.getCreditAvailableQuantity())throw new ResponseStatusException(HttpStatus.CONFLICT,"Credit quantity exceeds the remaining billed quantity for "+line.getSku());
            total=total.add(line.getUnitPrice().multiply(BigDecimal.valueOf(input.quantity())));
        }
        if(total.compareTo(bill.getBalance())>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Credit exceeds the supplier bill's remaining balance after payments");
        requested.sort(Comparator.comparing(input->billLines.get(input.supplierBillLineId()).getPurchaseOrderLine().getItem().getId()));
        String number="CN-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        SupplierCreditNoteEntity note=new SupplierCreditNoteEntity(tenantId,bill,order,number,request.idempotencyKey(),reason,total);
        for(CreditLine input:requested){
            SupplierBillLineEntity billLine=billLines.get(input.supplierBillLineId());
            PurchaseOrderLineEntity poLine=billLine.getPurchaseOrderLine();
            if(!poLine.getPurchaseOrder().getId().equals(order.getId()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Supplier bill line does not belong to the locked purchase order");
            ItemEntity item=items.findForUpdate(tenantId,poLine.getItem().getId()).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Item no longer exists"));
            var main=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"No default warehouse is configured"));var balance=warehouseStock.findByLocationAndItem(tenantId,main.getId(),item.getId()).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Stock balance is missing"));int defaultAvailable=balance.getOnHand()-balance.getReservedQuantity()-balance.getManufacturingReservedQuantity()-balance.getQualityHoldQuantity();if(input.quantity()>defaultAvailable)throw new ResponseStatusException(HttpStatus.CONFLICT,"Credit return exceeds stock available at "+main.getName()+" for "+item.getSku());
            try{billLine.credit(input.quantity());poLine.creditAndReturnBilled(input.quantity());item.adjustStock(-input.quantity());}
            catch(IllegalArgumentException|ArithmeticException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,exception.getMessage());}
            note.addLine(tenantId,billLine,input.quantity());
            movements.save(new InventoryMovementEntity(tenantId,item,-input.quantity(),"Supplier credit return",number));
        }
        bill.recordCredit(total);
        try{return CreditNoteView.from(notes.saveAndFlush(note));}
        catch(DataIntegrityViolationException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"Credit note already exists; retry with its idempotency key");}
    }
}
