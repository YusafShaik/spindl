package si.spindl.purchasing;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.tenant.CurrentTenant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Year;
import java.util.*;

import static si.spindl.purchasing.PurchaseRequisitionDtos.*;
import static si.spindl.purchasing.PurchaseOrderDtos.PurchaseOrderView;

@Service
public class PurchaseRequisitionService {
    private final CurrentTenant tenant;
    private final PurchaseRequisitionRepository requisitions;
    private final PurchaseOrderRepository purchaseOrders;
    private final SupplierRepository suppliers;
    private final ItemRepository items;
    private final TenantAuditEventRepository audit;
    public PurchaseRequisitionService(CurrentTenant tenant,PurchaseRequisitionRepository requisitions,PurchaseOrderRepository purchaseOrders,SupplierRepository suppliers,ItemRepository items,TenantAuditEventRepository audit){this.tenant=tenant;this.requisitions=requisitions;this.purchaseOrders=purchaseOrders;this.suppliers=suppliers;this.items=items;this.audit=audit;}

    @Transactional(readOnly=true)
    public List<View> list(){return requisitions.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId()).stream().map(PurchaseRequisitionMapper::toView).toList();}

    @Transactional
    public View create(UUID actorId,CreateRequest request){
        UUID tenantId=tenant.currentTenantId();List<LineRequest> lines=normalize(request.lines());String notes=clean(request.notes());String hash=hash(request.needByDate()+"\n"+Objects.toString(notes,"")+"\n"+lines.stream().map(line->line.itemId()+":"+line.quantity()).reduce((a,b)->a+"\n"+b).orElse(""));
        var prior=requisitions.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);if(prior!=null){if(!prior.getRequestHash().equals(hash))throw conflict("Idempotency key was reused with different requisition details");return PurchaseRequisitionMapper.toView(prior);}
        String number="PR-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        var requisition=new PurchaseRequisitionEntity(tenantId,number,request.idempotencyKey(),hash,actorId,request.needByDate(),notes);
        for(LineRequest line:lines){ItemEntity item=items.findByTenantIdAndId(tenantId,line.itemId()).filter(ItemEntity::isActive).orElseThrow(()->badRequest("A requested item is missing or inactive"));requisition.addLine(item,line.quantity());}
        try{var saved=requisitions.saveAndFlush(requisition);audit.save(new TenantAuditEventEntity(tenantId,actorId,"PURCHASE_REQUISITION_SUBMITTED","purchase_requisition",saved.getId(),Map.of("requisitionNumber",number,"lineCount",lines.size())));return PurchaseRequisitionMapper.toView(saved);}catch(DataIntegrityViolationException exception){throw conflict("Requisition request already exists; retry with its idempotency key");}
    }

    @Transactional
    public View approve(UUID actorId,UUID id){UUID tenantId=tenant.currentTenantId();var requisition=lock(tenantId,id);if(!requisition.getStatus().equals("SUBMITTED"))throw conflict("Only submitted requisitions can be approved");requisition.approve(actorId);audit.save(new TenantAuditEventEntity(tenantId,actorId,"PURCHASE_REQUISITION_APPROVED","purchase_requisition",id,Map.of("requisitionNumber",requisition.getRequisitionNumber())));return PurchaseRequisitionMapper.toView(requisition);}

    @Transactional
    public View reject(UUID actorId,UUID id,String requestedReason){UUID tenantId=tenant.currentTenantId();var requisition=lock(tenantId,id);if(!requisition.getStatus().equals("SUBMITTED"))throw conflict("Only submitted requisitions can be rejected");String reason=requestedReason.trim();requisition.reject(actorId,reason);audit.save(new TenantAuditEventEntity(tenantId,actorId,"PURCHASE_REQUISITION_REJECTED","purchase_requisition",id,Map.of("requisitionNumber",requisition.getRequisitionNumber(),"reason",reason)));return PurchaseRequisitionMapper.toView(requisition);}

    @Transactional
    public PurchaseOrderView convert(UUID actorId,UUID id,ConvertRequest request){
        UUID tenantId=tenant.currentTenantId();var requisition=lock(tenantId,id);
        if(request.lines().stream().map(ConvertLineRequest::requisitionLineId).distinct().count()!=request.lines().size())throw badRequest("Each requisition line can only be priced once");
        Map<UUID,PurchaseRequisitionLineEntity> requestedLines=new HashMap<>();requisition.getLines().forEach(line->requestedLines.put(line.getId(),line));
        if(request.lines().size()!=requestedLines.size()||request.lines().stream().anyMatch(line->!requestedLines.containsKey(line.requisitionLineId())))throw badRequest("Provide one price for every requisition line");
        List<ConvertLineRequest> prices=new ArrayList<>(request.lines());prices.sort(Comparator.comparing(line->requestedLines.get(line.requisitionLineId()).getItem().getId().toString()));
        String conversionHash=hash(request.supplierId()+"\n"+prices.stream().map(line->line.requisitionLineId()+":"+line.unitPrice().setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).reduce((a,b)->a+"\n"+b).orElse(""));
        if(requisition.getStatus().equals("CONVERTED")){if(!requisition.matchesConversion(request.idempotencyKey(),conversionHash))throw conflict("This requisition was already converted with different supplier or price details");return purchaseOrders.findByTenantIdAndId(tenantId,requisition.getPurchaseOrder().getId()).map(PurchaseOrderMapper::toPurchaseOrderView).orElseThrow(()->conflict("The linked purchase order is missing"));}
        if(!requisition.getStatus().equals("APPROVED"))throw conflict("Approve this requisition before converting it to a purchase order");
        var supplier=suppliers.findByTenantIdAndIdAndActiveTrue(tenantId,request.supplierId()).orElseThrow(()->badRequest("Supplier is missing or inactive"));
        String orderNumber="PO-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        var order=new PurchaseOrderEntity(tenantId,orderNumber,supplier,"Created from "+requisition.getRequisitionNumber());
        for(ConvertLineRequest price:prices){var line=requestedLines.get(price.requisitionLineId());ItemEntity item=items.findByTenantIdAndId(tenantId,line.getItem().getId()).filter(ItemEntity::isActive).orElseThrow(()->conflict("A requested item is no longer active"));order.addLine(item,line.getQuantity(),price.unitPrice().setScale(2,java.math.RoundingMode.HALF_UP));}
        var savedOrder=purchaseOrders.save(order);requisition.convert(savedOrder,request.idempotencyKey(),conversionHash);
        try{requisitions.saveAndFlush(requisition);audit.save(new TenantAuditEventEntity(tenantId,actorId,"PURCHASE_REQUISITION_CONVERTED","purchase_requisition",id,Map.of("requisitionNumber",requisition.getRequisitionNumber(),"purchaseOrderNumber",orderNumber,"supplier",supplier.getName())));return PurchaseOrderMapper.toPurchaseOrderView(savedOrder);}catch(DataIntegrityViolationException exception){throw conflict("Requisition conversion already exists; retry with its idempotency key");}
    }

    private List<LineRequest> normalize(List<LineRequest> input){if(input==null||input.isEmpty())throw badRequest("Add at least one item to the requisition");if(input.stream().map(LineRequest::itemId).distinct().count()!=input.size())throw badRequest("Each item can appear only once per requisition");return input.stream().sorted(Comparator.comparing(line->line.itemId().toString())).toList();}
    private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
    private String hash(String input){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));}catch(Exception exception){throw new IllegalStateException(exception);}}
    private PurchaseRequisitionEntity lock(UUID tenantId,UUID id){return requisitions.findForUpdate(tenantId,id).orElseThrow(()->new NotFoundException("Purchase requisition not found"));}
    private ResponseStatusException badRequest(String message){return new BadRequestException(message);}
    private ResponseStatusException conflict(String message){return new ConflictException(message);}
}
