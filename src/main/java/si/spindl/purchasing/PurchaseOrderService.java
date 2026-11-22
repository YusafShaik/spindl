package si.spindl.purchasing;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.inventory.WarehouseEntity;
import si.spindl.inventory.WarehouseRepository;
import si.spindl.inventory.WarehouseStockEntity;
import si.spindl.inventory.WarehouseStockRepository;
import si.spindl.purchasing.PurchaseOrderDtos.*;
import si.spindl.tenant.CurrentTenant;
import si.spindl.quality.QualityLotEntity;
import si.spindl.quality.QualityLotRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.reports.WorkflowStudioDtos;
import si.spindl.reports.WorkflowStudioService;
import si.spindl.identity.TenantWebhookService;

import java.time.Year;
import java.util.*;

@Service
public class PurchaseOrderService {
    private final PurchaseOrderRepository orders;
    private final SupplierRepository suppliers;
    private final ItemRepository items;
    private final GoodsReceiptRepository receipts;
    private final PurchaseReturnRepository returns;
    private final InventoryMovementRepository movements;
    private final CurrentTenant tenant;
    private final QualityLotRepository qualityLots;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    private final PurchaseOrderApprovalRepository approvals;
    private final TenantMembershipRepository memberships;
    private final TenantAuditEventRepository audit;
    private final WorkflowStudioService workflows;
    private final TenantWebhookService webhooks;

    public PurchaseOrderService(PurchaseOrderRepository orders,SupplierRepository suppliers,ItemRepository items,
                                GoodsReceiptRepository receipts,PurchaseReturnRepository returns,InventoryMovementRepository movements,CurrentTenant tenant,QualityLotRepository qualityLots,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock,PurchaseOrderApprovalRepository approvals,TenantMembershipRepository memberships,TenantAuditEventRepository audit,WorkflowStudioService workflows,TenantWebhookService webhooks){
        this.orders=orders;this.suppliers=suppliers;this.items=items;this.receipts=receipts;this.returns=returns;this.movements=movements;this.tenant=tenant;this.qualityLots=qualityLots;this.warehouses=warehouses;this.warehouseStock=warehouseStock;this.approvals=approvals;this.memberships=memberships;this.audit=audit;this.workflows=workflows;this.webhooks=webhooks;
    }

    @Transactional(readOnly=true)
    public List<PurchaseOrderView> list(){return orders.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId()).stream().map(PurchaseOrderMapper::toPurchaseOrderView).toList();}

    @Transactional(readOnly=true)
    public PurchaseOrderView get(UUID id){return PurchaseOrderMapper.toPurchaseOrderView(findOrder(id));}

    @Transactional(readOnly=true)
    public List<ReorderSuggestion> reorderSuggestions(){
        UUID tenantId=tenant.currentTenantId();
        Map<UUID,Integer> inbound=new HashMap<>();
        orders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(order->order.getStatus().equals("draft")||order.getStatus().equals("approved")||order.getStatus().equals("partially_received"))
                .flatMap(order->order.getLines().stream())
                .filter(line->line.getRemainingQuantity()>0)
                .forEach(line->inbound.merge(line.getItem().getId(),line.getRemainingQuantity(),Math::addExact));
        return items.findLowStock(tenantId).stream().map(item->{
            int incoming=inbound.getOrDefault(item.getId(),0);
            int suggested=Math.max(0,item.getLowStockThreshold()-item.getAvailableQuantity()-incoming);
            return new ReorderSuggestion(item.getId(),item.getSku(),item.getName(),item.getUnit(),item.getAvailableQuantity(),item.getLowStockThreshold(),incoming,suggested);
        }).filter(suggestion->suggestion.suggestedQuantity()>0).toList();
    }

    @Transactional
    public PurchaseOrderView create(CreateOrderRequest request,UUID actorId){
        UUID tenantId=tenant.currentTenantId();
        if(request.lines().stream().map(LineRequest::itemId).distinct().count()!=request.lines().size())throw new BadRequestException("Each item can appear only once per purchase order");
        SupplierEntity supplier=suppliers.findByTenantIdAndIdAndActiveTrue(tenantId,request.supplierId()).orElseThrow(()->new BadRequestException("Supplier is missing or inactive"));
        String orderNumber="PO-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        PurchaseOrderEntity order=new PurchaseOrderEntity(tenantId,orderNumber,supplier,request.notes(),actorId);
        for(LineRequest line:request.lines()){
            ItemEntity item=items.findByTenantIdAndId(tenantId,line.itemId()).filter(ItemEntity::isActive).orElseThrow(()->new BadRequestException("An item is missing or inactive"));
            order.addLine(item,line.quantity(),line.unitPrice());
        }
        return PurchaseOrderMapper.toPurchaseOrderView(orders.save(order));
    }

    @Transactional
    public PurchaseOrderView approve(UUID id,UUID actorId){
        UUID tenantId=tenant.currentTenantId();
        PurchaseOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,id).orElseThrow(()->new NotFoundException());
        String actorRole=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->new ForbiddenException("Active workspace membership is required"));
        WorkflowStudioDtos.Policy policy=workflows.activePolicy(tenantId);
        if(!actorRole.equals(policy.approverRole())&&!Set.of("OWNER","ADMIN").contains(actorRole))throw new ForbiddenException("Your workspace role cannot approve this purchase order");
        if(approvals.findByTenantIdAndPurchaseOrderIdAndApproverUserId(tenantId,id,actorId).isPresent())return PurchaseOrderMapper.toPurchaseOrderView(order);
        if(!order.getStatus().equals("draft")&&!order.getStatus().equals("pending_approval"))throw new ConflictException("Only draft or pending purchase orders can be approved");
        if(order.getStatus().equals("draft")){
            int required=order.getTotal().compareTo(policy.amountThreshold())>=0?policy.requiredApprovals():1;
            if(required>1&&actorId.equals(order.getCreatedBy()))throw new ForbiddenException("The requester cannot approve a high value purchase order");
            order.startApproval(required);
        }
        if(order.getApprovalRequiredCount()>1&&actorId.equals(order.getCreatedBy()))throw new ForbiddenException("The requester cannot approve a high value purchase order");
        approvals.save(new PurchaseOrderApprovalEntity(tenantId,id,actorId));
        long received=approvals.countByTenantIdAndPurchaseOrderId(tenantId,id);
        if(received>=order.getApprovalRequiredCount())order.approve();
        orders.save(order);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"PURCHASE_ORDER_APPROVAL_RECORDED","purchase_order",id,Map.of("orderNumber",order.getOrderNumber(),"approvalCount",received,"requiredApprovals",order.getApprovalRequiredCount(),"status",order.getStatus())));
        Map<String,Object> eventData=Map.of("purchaseOrderId",id.toString(),"orderNumber",order.getOrderNumber(),"approvalCount",received,"requiredApprovals",order.getApprovalRequiredCount(),"status",order.getStatus());
        webhooks.enqueue(tenantId,"PURCHASE_ORDER_APPROVAL_RECORDED",eventData);
        if(order.getStatus().equals("approved"))webhooks.enqueue(tenantId,"PURCHASE_ORDER_APPROVED",eventData);
        return PurchaseOrderMapper.toPurchaseOrderView(order);
    }

    @Transactional
    public ReceiptView receive(UUID id,ReceiveRequest request){
        UUID tenantId=tenant.currentTenantId();
        PurchaseOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,id).orElseThrow(()->new NotFoundException());
        GoodsReceiptEntity previous=receipts.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(previous!=null){if(!previous.getPurchaseOrder().getId().equals(id))throw new ConflictException("Idempotency key was used for another purchase order");return PurchaseOrderMapper.toReceiptView(previous);}
        if(!order.getStatus().equals("approved")&&!order.getStatus().equals("partially_received"))throw new ConflictException("Purchase order must be approved before receiving");
        if(request.lines().stream().map(ReceiveLine::purchaseOrderLineId).distinct().count()!=request.lines().size())throw new BadRequestException("A purchase order line can only be received once per receipt");

        String receiptNumber="GRN-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        GoodsReceiptEntity receipt=new GoodsReceiptEntity(tenantId,order,receiptNumber,request.idempotencyKey());
        for(ReceiveLine input:request.lines()){
            int total;
            try{total=Math.addExact(input.acceptedQuantity(),input.rejectedQuantity());}
            catch(ArithmeticException e){throw new BadRequestException("Receipt quantity is too large");}
            if(total<=0)throw new BadRequestException("Enter an accepted or rejected quantity");
            PurchaseOrderLineEntity line=order.getLines().stream().filter(candidate->candidate.getId().equals(input.purchaseOrderLineId())).findFirst().orElseThrow(()->new BadRequestException("Receipt contains a line that is not on this purchase order"));
            if(total>line.getRemainingQuantity())throw new ConflictException("Received quantity exceeds the remaining ordered quantity for "+line.getItem().getSku());
            WarehouseEntity warehouse=(input.warehouseId()==null?warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId):warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,input.warehouseId())).orElseThrow(()->new BadRequestException("Choose an active receiving warehouse"));
            line.receive(input.acceptedQuantity(),input.rejectedQuantity());
            receipt.addLine(line,warehouse,input.acceptedQuantity(),input.rejectedQuantity());
            if(input.acceptedQuantity()>0){
                ItemEntity item=items.findActiveForUpdate(tenantId,line.getItem().getId()).orElseThrow(()->new ConflictException("Item is no longer active"));
                WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->new ConflictException("Stock balance is missing at "+warehouse.getName()));
                balance.receiveStock(input.acceptedQuantity());
                if(item.isQualityInspectionRequired()){item.receiveStockForQuality(input.acceptedQuantity());balance.addQualityHold(input.acceptedQuantity());qualityLots.save(new QualityLotEntity(tenantId,item,warehouse,"PURCHASE_RECEIPT",receiptNumber+"/"+line.getId(),input.acceptedQuantity()));}else item.receiveStock(input.acceptedQuantity());
                movements.save(new InventoryMovementEntity(tenantId,item,warehouse,input.acceptedQuantity(),"Purchase receipt",receiptNumber,null));
            }
        }
        order.refreshReceiptStatus();
        orders.save(order);
        try{return PurchaseOrderMapper.toReceiptView(receipts.saveAndFlush(receipt));}
        catch(DataIntegrityViolationException exception){throw new ConflictException("This receipt request was already posted; retry with its idempotency key");}
    }

    @Transactional
    public ReturnView returnGoods(UUID id,ReturnRequest request){
        UUID tenantId=tenant.currentTenantId();
        PurchaseOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,id).orElseThrow(()->new NotFoundException());
        String reason=request.reason().trim();
        if(request.lines().stream().map(ReturnLine::purchaseOrderLineId).distinct().count()!=request.lines().size())throw new BadRequestException("A purchase order line can only be returned once per return");
        PurchaseReturnEntity prior=returns.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,reason,request.lines()))throw new ConflictException("Idempotency key was reused with different return details");return PurchaseOrderMapper.toReturnView(prior);}
        if(!order.getStatus().equals("received")&&!order.getStatus().equals("partially_received"))throw new ConflictException("Purchase order must have received goods before a return can be posted");
        Map<UUID,PurchaseOrderLineEntity> orderLines=new HashMap<>();order.getLines().forEach(line->orderLines.put(line.getId(),line));
        List<ReturnLine> inputs=new ArrayList<>(request.lines());
        for(ReturnLine input:inputs)if(!orderLines.containsKey(input.purchaseOrderLineId()))throw new BadRequestException("Return contains a line that is not on this purchase order");
        inputs.sort(Comparator.comparing(input->orderLines.get(input.purchaseOrderLineId()).getItem().getId()));
        String returnNumber="RET-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        PurchaseReturnEntity purchaseReturn=new PurchaseReturnEntity(tenantId,order,returnNumber,request.idempotencyKey(),reason);
        for(ReturnLine input:inputs){
            PurchaseOrderLineEntity line=orderLines.get(input.purchaseOrderLineId());
            if(input.quantity()>line.getReturnableQuantity())throw new ConflictException("Return exceeds the accepted quantity still returnable for "+line.getItem().getSku());
            ItemEntity item=items.findForUpdate(tenantId,line.getItem().getId()).orElseThrow(()->new ConflictException("Item no longer exists"));
            WarehouseEntity main=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElseThrow(()->new ConflictException("No default warehouse is configured"));
            WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,main.getId(),item.getId()).orElseThrow(()->new ConflictException("Stock balance is missing for "+item.getSku()));
            ensureDefaultAvailable(tenantId,item,input.quantity());
            try{balance.adjustStock(-input.quantity());item.adjustStock(-input.quantity());line.returnAccepted(input.quantity());}catch(IllegalArgumentException|ArithmeticException exception){throw new ConflictException(exception.getMessage());}
            purchaseReturn.addLine(line,input.quantity());
            movements.save(new InventoryMovementEntity(tenantId,item,-input.quantity(),"Purchase return",returnNumber));
        }
        orders.save(order);
        try{return PurchaseOrderMapper.toReturnView(returns.saveAndFlush(purchaseReturn));}
        catch(DataIntegrityViolationException exception){throw new ConflictException("This return request already exists; retry with its idempotency key");}
    }

    private PurchaseOrderEntity findOrder(UUID id){return orders.findByTenantIdAndId(tenant.currentTenantId(),id).orElseThrow(()->new NotFoundException());}
    private void ensureDefaultAvailable(UUID tenantId,ItemEntity item,int quantity){WarehouseEntity main=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElseThrow(()->new ConflictException("No default warehouse is configured"));WarehouseStockEntity balance=warehouseStock.findByLocationAndItem(tenantId,main.getId(),item.getId()).orElseThrow(()->new ConflictException("Stock balance is missing for "+item.getSku()));int available=balance.getOnHand()-balance.getReservedQuantity()-balance.getManufacturingReservedQuantity()-balance.getQualityHoldQuantity();if(quantity>available)throw new ConflictException("Return exceeds stock available at "+main.getName()+" for "+item.getSku());}
}
