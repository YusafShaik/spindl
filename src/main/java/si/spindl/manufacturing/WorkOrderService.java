package si.spindl.manufacturing;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.quality.QualityLotEntity;
import si.spindl.quality.QualityLotRepository;
import si.spindl.purchasing.PurchaseOrderLineCostRepository;
import si.spindl.purchasing.AcceptedPurchaseCost;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class WorkOrderService {
    private final WorkOrderRepository orders; private final WorkOrderMaterialRepository materials; private final WorkOrderOutputRepository outputs;
    private final WorkOrderMaterialOperationRepository materialOperations; private final WorkOrderOperationRepository workOrderOperations; private final BomRepository boms; private final BomLineRepository bomLines; private final BomOperationRepository bomOperations; private final WorkCenterRepository workCenters;
    private final ItemRepository items; private final InventoryMovementRepository movements; private final TenantAuditEventRepository audit; private final TenantMembershipRepository memberships; private final QualityLotRepository qualityLots;
    private final WarehouseRepository warehouses; private final WarehouseStockRepository warehouseStock; private final PurchaseOrderLineCostRepository purchaseLineCosts;
    private final WorkOrderByproductOutputRepository byproductOutputs;
    private final WorkOrderReworkDispositionRepository reworkDispositions;
    public WorkOrderService(WorkOrderRepository orders,WorkOrderMaterialRepository materials,WorkOrderOutputRepository outputs,
                            WorkOrderMaterialOperationRepository materialOperations,WorkOrderOperationRepository workOrderOperations,BomRepository boms,BomLineRepository bomLines,BomOperationRepository bomOperations,WorkCenterRepository workCenters,
                            ItemRepository items,InventoryMovementRepository movements,TenantAuditEventRepository audit,TenantMembershipRepository memberships,QualityLotRepository qualityLots,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock,PurchaseOrderLineCostRepository purchaseLineCosts,WorkOrderByproductOutputRepository byproductOutputs,WorkOrderReworkDispositionRepository reworkDispositions){
        this.orders=orders;this.materials=materials;this.outputs=outputs;this.materialOperations=materialOperations;this.workOrderOperations=workOrderOperations;this.boms=boms;this.bomLines=bomLines;this.bomOperations=bomOperations;this.workCenters=workCenters;this.items=items;this.movements=movements;this.audit=audit;this.memberships=memberships;this.qualityLots=qualityLots;this.warehouses=warehouses;this.warehouseStock=warehouseStock;this.purchaseLineCosts=purchaseLineCosts;this.byproductOutputs=byproductOutputs;this.reworkDispositions=reworkDispositions;
    }

    @Transactional(readOnly=true) public List<ManufacturingDtos.WorkOrderView> list(UUID tenantId){return orders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(o->view(tenantId,o)).toList();}

    @Transactional
    public ManufacturingDtos.WorkOrderView create(UUID tenantId,UUID actorId,ManufacturingDtos.CreateWorkOrderRequest request){
        String key=request.idempotencyKey().trim();
        LocalDate planned=request.plannedStart()==null?LocalDate.now():request.plannedStart();
        String priority=normalizePriority(request.priority());
        WarehouseEntity defaultWarehouse=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElseThrow(()->conflict("No default warehouse is configured"));
        WarehouseEntity outputWarehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,request.outputWarehouseId()==null?defaultWarehouse.getId():request.outputWarehouseId()).orElseThrow(()->badRequest("Choose an active output warehouse"));
        Map<UUID,UUID> allocationByComponent=new HashMap<>();if(request.materialAllocations()!=null){if(request.materialAllocations().stream().map(ManufacturingDtos.MaterialAllocation::componentItemId).distinct().count()!=request.materialAllocations().size())throw badRequest("A component can only be allocated once");request.materialAllocations().forEach(allocation->allocationByComponent.put(allocation.componentItemId(),allocation.warehouseId()));}
        BomEntity bom=boms.findByTenantIdAndId(tenantId,request.bomId()).orElseThrow(()->notFound("BOM not found"));
        if(!bom.getStatus().equals("APPROVED")||bom.getEffectiveFrom().isAfter(planned)||(bom.getEffectiveTo()!=null&&bom.getEffectiveTo().isBefore(planned)))throw conflict("Select an approved BOM revision effective on the planned start date");
        ItemEntity finished=lockItem(tenantId,bom.getFinishedItemId());
        List<BomLineEntity> bomComponents=bomLines.findAllByTenantIdAndBomIdOrderById(tenantId,bom.getId());
        if(bomComponents.isEmpty())throw conflict("The selected BOM has no components");
        Set<UUID> requestedAlternates=new HashSet<>(request.selectedAlternateComponentIds()==null?List.of():request.selectedAlternateComponentIds());if(request.selectedAlternateComponentIds()!=null&&requestedAlternates.size()!=request.selectedAlternateComponentIds().size())throw badRequest("An alternate component can only be selected once");
        Map<String,List<BomLineEntity>> alternatives=bomComponents.stream().filter(line->line.getAlternativeGroup()!=null).collect(java.util.stream.Collectors.groupingBy(BomLineEntity::getAlternativeGroup));Set<UUID> validAlternateIds=alternatives.values().stream().flatMap(List::stream).map(BomLineEntity::getComponentItemId).collect(java.util.stream.Collectors.toSet());if(!validAlternateIds.containsAll(requestedAlternates))throw badRequest("Selected alternate component is not in this BOM");
        var chosenAlternateIds=new HashSet<UUID>();for(var group:alternatives.values()){List<BomLineEntity> choices=group.stream().filter(line->requestedAlternates.contains(line.getComponentItemId())).toList();chosenAlternateIds.add(choices.isEmpty()?group.getFirst().getComponentItemId():choices.getFirst().getComponentItemId());}
        List<BomLineEntity> selectedComponents=bomComponents.stream().filter(line->line.getAlternativeGroup()==null||chosenAlternateIds.contains(line.getComponentItemId())).toList();Set<UUID> selectedComponentIds=selectedComponents.stream().map(BomLineEntity::getComponentItemId).collect(java.util.stream.Collectors.toSet());
        var existing=orders.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);
        if(existing!=null){var savedLines=materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,existing.getId());if(!existing.matches(request.bomId(),request.targetQuantity(),planned,request.dueDate(),priority,outputWarehouse.getId())||!savedLines.stream().map(WorkOrderMaterialEntity::getComponentItemId).collect(java.util.stream.Collectors.toSet()).equals(selectedComponentIds)||savedLines.stream().anyMatch(line->!line.getWarehouse().getId().equals(allocationByComponent.getOrDefault(line.getComponentItemId(),defaultWarehouse.getId()))))throw conflict("Idempotency key was already used for a different work order");return view(tenantId,existing);}
        LocalDate due=request.dueDate(); if(due!=null&&due.isBefore(planned))throw badRequest("Due date must not be before planned start");
        String number="WO-"+LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)+"-"+UUID.randomUUID().toString().substring(0,6).toUpperCase(Locale.ROOT);
        if(!selectedComponentIds.containsAll(allocationByComponent.keySet()))throw badRequest("Material allocation contains a component that was not selected for this work order");
        WorkOrderEntity order=orders.save(new WorkOrderEntity(tenantId,number,key,bom.getId(),finished.getId(),outputWarehouse,request.targetQuantity(),planned,due,priority));
        Map<UUID,BigDecimal> costBasis=weightedPurchaseUnitCosts(tenantId);var snapshots=new ArrayList<WorkOrderMaterialEntity>();
        for(BomLineEntity line:selectedComponents){WarehouseEntity materialWarehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,allocationByComponent.getOrDefault(line.getComponentItemId(),defaultWarehouse.getId())).orElseThrow(()->badRequest("Choose an active warehouse for each material component"));BigDecimal multiplier=BigDecimal.ONE.add(line.getScrapAllowancePercent().movePointLeft(2));int required=BigDecimal.valueOf(request.targetQuantity()).multiply(BigDecimal.valueOf(line.getQuantityPerUnit())).multiply(multiplier).setScale(0,RoundingMode.CEILING).intValueExact();snapshots.add(new WorkOrderMaterialEntity(tenantId,order.getId(),line.getComponentItemId(),materialWarehouse,line.getQuantityPerUnit(),line.getScrapAllowancePercent(),required,costBasis.get(line.getComponentItemId())));}
        materials.saveAll(snapshots);
        var routingSnapshots=new ArrayList<WorkOrderOperationEntity>();
        for(var operation:bomOperations.findAllByTenantIdAndBomIdOrderBySequenceAsc(tenantId,bom.getId())){var center=workCenters.findByTenantIdAndId(tenantId,operation.getWorkCenterId()).orElseThrow(()->conflict("A routing work center no longer exists"));routingSnapshots.add(new WorkOrderOperationEntity(tenantId,order.getId(),operation,center));}
        workOrderOperations.saveAll(routingSnapshots);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_CREATED","work_order",order.getId(),Map.of("orderNumber",number,"targetQuantity",request.targetQuantity(),"bomRevision",bom.getRevision())));
        return view(tenantId,order);
    }

    @Transactional(readOnly=true)
    public ManufacturingDtos.WorkOrderView availability(UUID tenantId,UUID id){return view(tenantId,find(tenantId,id));}

    @Transactional
    public ManufacturingDtos.WorkOrderView release(UUID tenantId,UUID actorId,UUID id){
        WorkOrderEntity order=lockOrder(tenantId,id);
        if(!order.getStatus().equals("DRAFT"))throw conflict("Only draft work orders can be released");
        for(var line:materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,id)){
            ItemEntity item=lockItem(tenantId,line.getComponentItemId());
            if(!item.isActive())throw conflict("A work order component is inactive");
            WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,line.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Stock balance is missing for component "+item.getSku()));
            int available=balance.getOnHand()-balance.getReservedQuantity()-balance.getManufacturingReservedQuantity()-balance.getQualityHoldQuantity();
            if(item.getAvailableQuantity()<line.getRequiredQuantity()||available<line.getRequiredQuantity())throw conflict("Insufficient available stock in "+line.getWarehouse().getName()+" for component "+item.getSku()+" (need "+line.getRequiredQuantity()+", available "+Math.max(0,available)+")");
            item.reserveForManufacturing(line.getRequiredQuantity());balance.reserveManufacturing(line.getRequiredQuantity());
        }
        order.release(); audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_RELEASED","work_order",id,Map.of("orderNumber",order.getOrderNumber())));
        return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView issue(UUID tenantId,UUID actorId,UUID id,UUID lineId,ManufacturingDtos.QuantityRequest request){
        var prior=materialOperations.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,lineId,"ISSUE",request.quantity()))throw conflict("Idempotency key was reused for another material operation");return view(tenantId,find(tenantId,id));}
        WorkOrderEntity order=lockOrder(tenantId,id);prior=materialOperations.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,lineId,"ISSUE",request.quantity()))throw conflict("Idempotency key was reused for another material operation");return view(tenantId,order);}
        if(!Set.of("RELEASED","IN_PROGRESS").contains(order.getStatus()))throw conflict("Work order must be released before material can be issued");
        var line=findMaterial(tenantId,id,lineId);ItemEntity item=lockItem(tenantId,line.getComponentItemId());
        WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,line.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Stock balance is missing for "+item.getSku()));
        int fromReservation=Math.min(request.quantity(),Math.max(0,line.getUnissuedQuantity()));
        int additional=request.quantity()-fromReservation;
        if(additional>0){int available=balance.getOnHand()-balance.getReservedQuantity()-balance.getManufacturingReservedQuantity()-balance.getQualityHoldQuantity()+fromReservation;if(additional>available)throw conflict("Insufficient additional stock in "+line.getWarehouse().getName()+" for "+item.getSku());}
        try { if(fromReservation>0){item.issueForManufacturing(fromReservation);balance.releaseManufacturingReservation(fromReservation);} if(additional>0){item.reserveForManufacturing(additional);balance.reserveManufacturing(additional);item.issueForManufacturing(additional);balance.releaseManufacturingReservation(additional);} }
        catch(IllegalArgumentException|ArithmeticException ex){throw conflict(ex.getMessage());}
        BigDecimal issueUnitCost=weightedPurchaseUnitCosts(tenantId).get(item.getId());BigDecimal issueCost=costAmount(issueUnitCost,request.quantity());line.issue(request.quantity()); order.begin();
        movements.save(new InventoryMovementEntity(tenantId,item,line.getWarehouse(),-request.quantity(),"Manufacturing issue",order.getOrderNumber()+"/MATERIAL",request.idempotencyKey()));
        materialOperations.save(new WorkOrderMaterialOperationEntity(tenantId,id,lineId,"ISSUE",request.quantity(),request.idempotencyKey(),issueUnitCost,issueCost));
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_MATERIAL_ISSUED","work_order",id,Map.of("sku",item.getSku(),"quantity",request.quantity())));
        return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView returnMaterial(UUID tenantId,UUID actorId,UUID id,UUID lineId,ManufacturingDtos.QuantityRequest request){
        var prior=materialOperations.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,lineId,"RETURN",request.quantity()))throw conflict("Idempotency key was reused for another material operation");return view(tenantId,find(tenantId,id));}
        WorkOrderEntity order=lockOrder(tenantId,id);prior=materialOperations.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,lineId,"RETURN",request.quantity()))throw conflict("Idempotency key was reused for another material operation");return view(tenantId,order);}
        if(!Set.of("RELEASED","IN_PROGRESS","PAUSED").contains(order.getStatus()))throw conflict("Material can only be returned from an open work order");
        var line=findMaterial(tenantId,id,lineId);int consumedForReportedOutput=requiredForUnits(line,order.getGoodQuantity()+order.getScrapQuantity()+order.getReworkQuantity());int returnable=Math.max(0,line.getUnreturnedIssuedQuantity()-consumedForReportedOutput);if(request.quantity()>returnable)throw conflict("Return quantity would leave too little material for output already recorded");
        ItemEntity item=lockItem(tenantId,line.getComponentItemId());List<WorkOrderMaterialOperationEntity> priorCostOperations=materialOperations.findAllByTenantIdAndWorkOrderIdOrderByCreatedAtAsc(tenantId,id).stream().filter(operation->operation.getMaterialLineId().equals(lineId)).toList();int unknownIssued=priorCostOperations.stream().filter(operation->"ISSUE".equals(operation.getOperation())&&operation.getUnitCost()==null).mapToInt(WorkOrderMaterialOperationEntity::getQuantity).sum();int unknownReturned=priorCostOperations.stream().filter(operation->"RETURN".equals(operation.getOperation())&&operation.getUnitCost()==null).mapToInt(WorkOrderMaterialOperationEntity::getQuantity).sum();int unpricedUnits=Math.min(request.quantity(),Math.max(0,unknownIssued-unknownReturned));int pricedReturnUnits=request.quantity()-unpricedUnits;BigDecimal returnUnitCost=pricedReturnUnits>0?weightedIssuedUnitCost(tenantId,id,lineId,line.getUnreturnedIssuedQuantity()):null;BigDecimal returnCost=costAmount(returnUnitCost,pricedReturnUnits);WarehouseStockEntity returnBalance=warehouseStock.findForUpdate(tenantId,line.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Stock balance is missing for "+item.getSku()));returnBalance.receiveStock(request.quantity());item.receiveStock(request.quantity());line.returnQuantity(request.quantity());
        movements.save(new InventoryMovementEntity(tenantId,item,line.getWarehouse(),request.quantity(),"Manufacturing return",order.getOrderNumber()+"/RETURN",request.idempotencyKey()));
        materialOperations.save(new WorkOrderMaterialOperationEntity(tenantId,id,lineId,"RETURN",request.quantity(),request.idempotencyKey(),returnUnitCost,returnCost));
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_MATERIAL_RETURNED","work_order",id,Map.of("sku",item.getSku(),"quantity",request.quantity())));
        return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView output(UUID tenantId,UUID actorId,UUID id,ManufacturingDtos.OutputRequest request){
        List<ManufacturingDtos.ByproductRequest> byproducts=request.byproducts()==null?List.of():request.byproducts();String fingerprint=byproductFingerprint(byproducts);
        var prior=outputs.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,request.goodQuantity(),request.scrapQuantity(),request.reworkQuantity(),fingerprint))throw conflict("Idempotency key was reused for another output");return view(tenantId,find(tenantId,id));}
        WorkOrderEntity order=lockOrder(tenantId,id);prior=outputs.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.matches(id,request.goodQuantity(),request.scrapQuantity(),request.reworkQuantity(),fingerprint))throw conflict("Idempotency key was reused for another output");return view(tenantId,order);}
        if(!Set.of("RELEASED","IN_PROGRESS","PAUSED").contains(order.getStatus()))throw conflict("Work order is not open for production output");
        if(request.goodQuantity()+request.scrapQuantity()+request.reworkQuantity()<=0&&byproducts.isEmpty())throw badRequest("Record good output, scrap, or at least one byproduct");
        if(request.goodQuantity()+request.scrapQuantity()+request.reworkQuantity()>order.getTargetQuantity()-order.getGoodQuantity()-order.getScrapQuantity()-order.getReworkQuantity())throw conflict("Reported output exceeds the remaining work order quantity");
        Set<String> uniqueByproducts=new HashSet<>();for(var byproduct:byproducts){if(!uniqueByproducts.add(byproduct.itemId()+":"+byproduct.warehouseId()))throw badRequest("Each byproduct item and warehouse combination can only be recorded once per output");if(byproduct.itemId().equals(order.getFinishedItemId()))throw badRequest("The finished item cannot also be recorded as its own byproduct");item(tenantId,byproduct.itemId());warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,byproduct.warehouseId()).orElseThrow(()->badRequest("Choose an active byproduct warehouse"));}
        var routing=workOrderOperations.findAllByTenantIdAndWorkOrderIdOrderBySequenceAsc(tenantId,id);
        if(!routing.isEmpty()){
            if(routing.stream().anyMatch(operation->!operation.getStatus().equals("COMPLETED")))throw conflict("Complete every routing operation before receiving finished goods");
            var finalOperation=routing.getLast();
            if(order.getGoodQuantity()+order.getScrapQuantity()+order.getReworkQuantity()+request.goodQuantity()+request.scrapQuantity()+request.reworkQuantity()>finalOperation.getProducedQuantity()+finalOperation.getScrapQuantity()+finalOperation.getReworkQuantity())throw conflict("Finished-goods receipt exceeds the quantities recorded by the final routing operation");
        }
        int unitsAfterOutput=order.getGoodQuantity()+order.getScrapQuantity()+order.getReworkQuantity()+request.goodQuantity()+request.scrapQuantity()+request.reworkQuantity();
        for(var line:materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,id))if(line.getUnreturnedIssuedQuantity()<requiredForUnits(line,unitsAfterOutput))throw conflict("Issue sufficient material for the reported output before recording production");
        ItemEntity finished=lockItem(tenantId,order.getFinishedItemId());if(request.goodQuantity()>0){WarehouseEntity outputWarehouse=order.getOutputWarehouse();WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,outputWarehouse.getId(),finished.getId()).orElseThrow(()->conflict("Finished item stock balance is missing"));balance.receiveStock(request.goodQuantity());if(finished.isQualityInspectionRequired()){finished.receiveStockForQuality(request.goodQuantity());balance.addQualityHold(request.goodQuantity());String outputReference=order.getOrderNumber()+"/OUTPUT/"+UUID.nameUUIDFromBytes(request.idempotencyKey().getBytes(java.nio.charset.StandardCharsets.UTF_8));qualityLots.save(new QualityLotEntity(tenantId,finished,outputWarehouse,"WORK_ORDER_OUTPUT",outputReference,request.goodQuantity()));}else finished.receiveStock(request.goodQuantity());movements.save(new InventoryMovementEntity(tenantId,finished,outputWarehouse,request.goodQuantity(),"Manufacturing output",order.getOrderNumber()+"/OUTPUT",request.idempotencyKey()));}
        WorkOrderOutputEntity outputRecord=outputs.save(new WorkOrderOutputEntity(tenantId,id,request.goodQuantity(),request.scrapQuantity(),request.reworkQuantity(),request.idempotencyKey(),fingerprint));
        for(var byproduct:byproducts){ItemEntity byproductItem=lockItem(tenantId,byproduct.itemId());WarehouseEntity byproductWarehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,byproduct.warehouseId()).orElseThrow(()->badRequest("Choose an active byproduct warehouse"));WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,byproductWarehouse.getId(),byproductItem.getId()).orElseGet(()->warehouseStock.save(new WarehouseStockEntity(tenantId,byproductWarehouse,byproductItem)));balance.receiveStock(byproduct.quantity());String movementKey=UUID.nameUUIDFromBytes((request.idempotencyKey()+"/BYPRODUCT/"+byproduct.itemId()+"/"+byproduct.warehouseId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();if(byproductItem.isQualityInspectionRequired()){byproductItem.receiveStockForQuality(byproduct.quantity());balance.addQualityHold(byproduct.quantity());qualityLots.save(new QualityLotEntity(tenantId,byproductItem,byproductWarehouse,"WORK_ORDER_BYPRODUCT",order.getOrderNumber()+"/BYPRODUCT/"+outputRecord.getId()+"/"+byproductItem.getSku(),byproduct.quantity()));}else byproductItem.receiveStock(byproduct.quantity());movements.save(new InventoryMovementEntity(tenantId,byproductItem,byproductWarehouse,byproduct.quantity(),"Manufacturing byproduct",order.getOrderNumber()+"/BYPRODUCT",movementKey));byproductOutputs.save(new WorkOrderByproductOutputEntity(tenantId,id,outputRecord.getId(),byproductItem.getId(),byproductWarehouse.getId(),byproduct.quantity()));}
        if(request.goodQuantity()+request.scrapQuantity()+request.reworkQuantity()>0)order.recordOutput(request.goodQuantity(),request.scrapQuantity(),request.reworkQuantity());
        if(order.getStatus().equals("COMPLETED"))releaseRemainingReservations(tenantId,id);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_OUTPUT_RECORDED","work_order",id,Map.of("good",request.goodQuantity(),"scrap",request.scrapQuantity(),"rework",request.reworkQuantity(),"byproductLines",byproducts.size())));
        return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView disposeRework(UUID tenantId,UUID actorId,UUID id,ManufacturingDtos.ReworkDispositionRequest request){
        var prior=reworkDispositions.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);if(prior!=null){if(!prior.matches(id,request.quantity(),request.goodQuantity(),request.scrapQuantity()))throw conflict("Idempotency key was reused for another rework disposition");return view(tenantId,find(tenantId,id));}
        WorkOrderEntity order=lockOrder(tenantId,id);prior=reworkDispositions.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);if(prior!=null){if(!prior.matches(id,request.quantity(),request.goodQuantity(),request.scrapQuantity()))throw conflict("Idempotency key was reused for another rework disposition");return view(tenantId,order);}
        if(!Set.of("RELEASED","IN_PROGRESS","PAUSED").contains(order.getStatus()))throw conflict("Rework can only be dispositioned on an open work order");if(request.goodQuantity()+request.scrapQuantity()!=request.quantity())throw badRequest("Good and scrapped quantities must equal the rework quantity");if(request.quantity()>order.getReworkQuantity())throw conflict("Disposition quantity exceeds pending rework");
        order.disposeRework(request.quantity(),request.goodQuantity(),request.scrapQuantity());
        if(request.goodQuantity()>0){ItemEntity finished=lockItem(tenantId,order.getFinishedItemId());WarehouseEntity warehouse=order.getOutputWarehouse();if(finished.isQualityInspectionRequired()){finished.receiveStockForQuality(request.goodQuantity());WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),finished.getId()).orElseThrow(()->conflict("Finished item stock balance is missing"));balance.addQualityHold(request.goodQuantity());String reference=order.getOrderNumber()+"/REWORK/"+request.idempotencyKey();qualityLots.save(new QualityLotEntity(tenantId,finished,warehouse,"WORK_ORDER_REWORK",reference,request.goodQuantity()));}else finished.receiveStock(request.goodQuantity());String movementKey=UUID.nameUUIDFromBytes((request.idempotencyKey()+"/REWORK").getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();movements.save(new InventoryMovementEntity(tenantId,finished,warehouse,request.goodQuantity(),"Manufacturing rework output",order.getOrderNumber()+"/REWORK",movementKey));}
        reworkDispositions.save(new WorkOrderReworkDispositionEntity(tenantId,id,request.quantity(),request.goodQuantity(),request.scrapQuantity(),request.idempotencyKey()));if(order.getStatus().equals("COMPLETED"))releaseRemainingReservations(tenantId,id);audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_REWORK_DISPOSITIONED","work_order",id,Map.of("quantity",request.quantity(),"good",request.goodQuantity(),"scrap",request.scrapQuantity())));return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView pause(UUID tenantId,UUID actorId,UUID id){WorkOrderEntity order=lockOrder(tenantId,id);if(!order.getStatus().equals("IN_PROGRESS"))throw conflict("Only in-progress work orders can be paused");order.pause();audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_PAUSED","work_order",id,Map.of()));return view(tenantId,order);}
    @Transactional
    public ManufacturingDtos.WorkOrderView resume(UUID tenantId,UUID actorId,UUID id){WorkOrderEntity order=lockOrder(tenantId,id);if(!order.getStatus().equals("PAUSED"))throw conflict("Only paused work orders can resume");order.begin();audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_RESUMED","work_order",id,Map.of()));return view(tenantId,order);}
    @Transactional
    public ManufacturingDtos.WorkOrderView cancel(UUID tenantId,UUID actorId,UUID id){WorkOrderEntity order=lockOrder(tenantId,id);if(!Set.of("DRAFT","RELEASED","IN_PROGRESS","PAUSED").contains(order.getStatus()))throw conflict("This work order can no longer be cancelled");if(!order.getStatus().equals("DRAFT"))releaseRemainingReservations(tenantId,id);order.cancel();audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_CANCELLED","work_order",id,Map.of()));return view(tenantId,order);}
    @Transactional
    public ManufacturingDtos.WorkOrderView close(UUID tenantId,UUID actorId,UUID id){WorkOrderEntity order=lockOrder(tenantId,id);if(!order.getStatus().equals("COMPLETED"))throw conflict("Only completed work orders can be closed");order.close();audit.save(new TenantAuditEventEntity(tenantId,actorId,"WORK_ORDER_CLOSED","work_order",id,Map.of()));return view(tenantId,order);}

    @Transactional
    public ManufacturingDtos.WorkOrderView assignOperation(UUID tenantId,UUID actorId,UUID orderId,UUID operationId,ManufacturingDtos.AssignOperatorRequest request){
        WorkOrderEntity order=lockOrder(tenantId,orderId);if(!Set.of("RELEASED","IN_PROGRESS").contains(order.getStatus()))throw conflict("Release the work order before assigning a job card");
        WorkOrderOperationEntity operation=workOrderOperations.findForUpdate(tenantId,orderId,operationId).orElseThrow(()->notFound("Job card not found"));if(!operation.getStatus().equals("PENDING"))throw conflict("Only pending job cards can be assigned");
        if(request.operatorUserId()!=null&&memberships.findActiveRole(tenantId,request.operatorUserId()).filter("OPERATOR"::equals).isEmpty())throw badRequest("Select an active operator in this workspace");
        operation.assign(request.operatorUserId());audit.save(new TenantAuditEventEntity(tenantId,actorId,request.operatorUserId()==null?"JOB_CARD_UNASSIGNED":"JOB_CARD_ASSIGNED","work_order_operation",operationId,Map.of("workOrder",order.getOrderNumber(),"operatorUserId",request.operatorUserId()==null?"unassigned":request.operatorUserId().toString())));return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView startOperation(UUID tenantId,UUID actorId,UUID orderId,UUID operationId){
        WorkOrderEntity order=lockOrder(tenantId,orderId);
        if(!Set.of("RELEASED","IN_PROGRESS").contains(order.getStatus()))throw conflict("Release the work order before starting a job card");
        WorkOrderOperationEntity operation=workOrderOperations.findForUpdate(tenantId,orderId,operationId).orElseThrow(()->notFound("Job card not found"));
        if(operation.getStatus().equals("IN_PROGRESS")&&actorId.equals(operation.getOperatorUserId()))return view(tenantId,order);
        if(!operation.getStatus().equals("PENDING"))throw conflict("Job card is already complete or in progress");
        if(operation.getOperatorUserId()==null)throw conflict("A manager must assign this job card before it can start");
        if(!actorId.equals(operation.getOperatorUserId()))throw conflict("This job card is assigned to another operator");
        var prior=workOrderOperations.findAllByTenantIdAndWorkOrderIdOrderBySequenceAsc(tenantId,orderId).stream().filter(candidate->candidate.getSequence()<operation.getSequence()).toList();
        if(prior.stream().anyMatch(candidate->!candidate.getStatus().equals("COMPLETED")))throw conflict("Complete the previous routing operation first");
        operation.start(actorId);order.begin();
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"JOB_CARD_STARTED","work_order_operation",operationId,Map.of("workOrder",order.getOrderNumber(),"sequence",operation.getSequence())));
        return view(tenantId,order);
    }

    @Transactional
    public ManufacturingDtos.WorkOrderView completeOperation(UUID tenantId,UUID actorId,UUID orderId,UUID operationId,ManufacturingDtos.CompleteOperationRequest request){
        WorkOrderOperationEntity prior=workOrderOperations.findByTenantIdAndCompletionKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.getWorkOrderId().equals(orderId)||!prior.getId().equals(operationId)||!prior.matchesCompletion(request))throw conflict("Idempotency key was reused for another job-card completion");return view(tenantId,find(tenantId,orderId));}
        WorkOrderEntity order=lockOrder(tenantId,orderId);
        WorkOrderOperationEntity operation=workOrderOperations.findForUpdate(tenantId,orderId,operationId).orElseThrow(()->notFound("Job card not found"));
        prior=workOrderOperations.findByTenantIdAndCompletionKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.getWorkOrderId().equals(orderId)||!prior.getId().equals(operationId)||!prior.matchesCompletion(request))throw conflict("Idempotency key was reused for another job-card completion");return view(tenantId,order);}
        if(!operation.getStatus().equals("IN_PROGRESS")||!actorId.equals(operation.getOperatorUserId()))throw conflict("Start this job card before completing it");
        if(request.producedQuantity()+request.scrapQuantity()+request.reworkQuantity()<=0)throw badRequest("Record produced or scrapped units");
        if(request.producedQuantity()+request.scrapQuantity()+request.reworkQuantity()>order.getTargetQuantity())throw conflict("Job-card quantity cannot exceed the work-order target");
        var priorOperations=workOrderOperations.findAllByTenantIdAndWorkOrderIdOrderBySequenceAsc(tenantId,orderId).stream().filter(candidate->candidate.getSequence()<operation.getSequence()).toList();
        if(!priorOperations.isEmpty()){
            var previous=priorOperations.getLast();
            if(request.producedQuantity()+request.scrapQuantity()+request.reworkQuantity()>previous.getProducedQuantity()+previous.getScrapQuantity()+previous.getReworkQuantity())throw conflict("Job-card output cannot exceed the quantity completed by the previous routing operation");
        }else{
            int materialSupportedUnits=materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,orderId).stream().mapToInt(this::unitsSupportedByIssuedMaterial).min().orElse(0);
            if(request.producedQuantity()+request.scrapQuantity()+request.reworkQuantity()>materialSupportedUnits)throw conflict("Job-card output exceeds the quantity supported by issued materials");
        }
        if(request.downtimeMinutes()>0&&(request.downtimeReason()==null||request.downtimeReason().isBlank()))throw badRequest("Provide a downtime reason when downtime is recorded");
        operation.complete(request.producedQuantity(),request.scrapQuantity(),request.reworkQuantity(),request.actualSetupMinutes(),request.actualRunMinutes(),request.downtimeMinutes(),request.downtimeReason(),request.idempotencyKey());
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"JOB_CARD_COMPLETED","work_order_operation",operationId,Map.of("workOrder",order.getOrderNumber(),"produced",request.producedQuantity(),"scrap",request.scrapQuantity(),"rework",request.reworkQuantity(),"downtimeMinutes",request.downtimeMinutes())));
        return view(tenantId,order);
    }

    private void releaseRemainingReservations(UUID tenantId,UUID id){for(var line:materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,id)){int quantity=Math.max(0,line.getRequiredQuantity()-line.getIssuedQuantity());if(quantity>0){ItemEntity item=lockItem(tenantId,line.getComponentItemId());WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,line.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Reserved warehouse stock balance is missing"));item.releaseManufacturingReservation(quantity);balance.releaseManufacturingReservation(quantity);}}}
    private String byproductFingerprint(List<ManufacturingDtos.ByproductRequest> byproducts){if(byproducts.isEmpty())return "";String canonical=byproducts.stream().sorted(Comparator.comparing((ManufacturingDtos.ByproductRequest line)->line.itemId().toString()).thenComparing(line->line.warehouseId().toString())).map(line->line.itemId()+":"+line.warehouseId()+":"+line.quantity()).collect(java.util.stream.Collectors.joining("|"));try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException ex){throw new IllegalStateException("SHA-256 is unavailable",ex);}}
    private Map<UUID,BigDecimal> weightedPurchaseUnitCosts(UUID tenantId){Map<UUID,BigDecimal> costs=new HashMap<>();for(AcceptedPurchaseCost row:purchaseLineCosts.findAcceptedCostBasis(tenantId)){if(row.getTotalUnits()!=null&&row.getTotalUnits()>0)costs.put(row.getItemId(),row.getTotalValue().divide(BigDecimal.valueOf(row.getTotalUnits()),4,RoundingMode.HALF_UP));}return costs;}
    private BigDecimal costAmount(BigDecimal unitCost,int quantity){return unitCost==null?null:unitCost.multiply(BigDecimal.valueOf(quantity)).setScale(2,RoundingMode.HALF_UP);}
    private BigDecimal weightedIssuedUnitCost(UUID tenantId,UUID orderId,UUID lineId,int unreturnedQuantity){if(unreturnedQuantity<=0)return null;BigDecimal value=BigDecimal.ZERO;long units=0;for(var operation:materialOperations.findAllByTenantIdAndWorkOrderIdOrderByCreatedAtAsc(tenantId,orderId)){if(!operation.getMaterialLineId().equals(lineId)||operation.getUnitCost()==null)continue;if("ISSUE".equals(operation.getOperation())){value=value.add(operation.getCostAmount()==null?BigDecimal.ZERO:operation.getCostAmount());units+=operation.getQuantity();}else if("RETURN".equals(operation.getOperation())){value=value.subtract(operation.getCostAmount()==null?BigDecimal.ZERO:operation.getCostAmount());units-=operation.getQuantity();}}return units<=0?null:value.divide(BigDecimal.valueOf(units),4,RoundingMode.HALF_UP);}
    private int requiredForUnits(WorkOrderMaterialEntity line,int units){return BigDecimal.valueOf(units).multiply(BigDecimal.valueOf(line.getQuantityPerUnit())).multiply(BigDecimal.ONE.add(line.getScrapAllowancePercent().movePointLeft(2))).setScale(0,RoundingMode.CEILING).intValueExact();}
    private int unitsSupportedByIssuedMaterial(WorkOrderMaterialEntity line){BigDecimal materialPerUnit=BigDecimal.valueOf(line.getQuantityPerUnit()).multiply(BigDecimal.ONE.add(line.getScrapAllowancePercent().movePointLeft(2)));return BigDecimal.valueOf(line.getUnreturnedIssuedQuantity()).divide(materialPerUnit,0,RoundingMode.FLOOR).intValue();}
    private ManufacturingDtos.WorkOrderView view(UUID tenantId,WorkOrderEntity order){
        BomEntity bom=boms.findByTenantIdAndId(tenantId,order.getBomId()).orElseThrow();ItemEntity finished=item(tenantId,order.getFinishedItemId());
        var materialLines=materials.findAllByTenantIdAndWorkOrderIdOrderById(tenantId,order.getId());
        var materialViews=materialLines.stream().map(line->{ItemEntity component=item(tenantId,line.getComponentItemId());WarehouseStockEntity balance=warehouseStock.findByLocationAndItem(tenantId,line.getWarehouse().getId(),component.getId()).orElseThrow(()->conflict("Material warehouse stock balance is missing"));int held=Set.of("RELEASED","IN_PROGRESS","PAUSED").contains(order.getStatus())?Math.max(0,line.getRequiredQuantity()-line.getIssuedQuantity()):0;int available=balance.getOnHand()-balance.getReservedQuantity()-balance.getManufacturingReservedQuantity()-balance.getQualityHoldQuantity()+held;int shortage=Math.max(0,line.getRequiredQuantity()-line.getIssuedQuantity()-available);return new ManufacturingDtos.MaterialView(line.getId(),component.getId(),component.getSku(),component.getName(),component.getUnit(),line.getWarehouse().getId(),line.getWarehouse().getCode(),line.getWarehouse().getName(),line.getQuantityPerUnit(),line.getScrapAllowancePercent(),line.getRequiredQuantity(),line.getIssuedQuantity(),line.getReturnedQuantity(),available,shortage);}).toList();
        var orderOperations=workOrderOperations.findAllByTenantIdAndWorkOrderIdOrderBySequenceAsc(tenantId,order.getId());
        var operationViews=orderOperations.stream().map(op->new ManufacturingDtos.WorkOrderOperationView(op.getId(),op.getSequence(),op.getName(),op.getWorkCenterId(),op.getWorkCenterCode(),op.getWorkCenterName(),op.getSetupMinutes(),op.getRunMinutesPerUnit(),op.getSkillRequirements(),op.getStatus(),op.getOperatorUserId(),op.getStartedAt(),op.getCompletedAt(),op.getActualSetupMinutes(),op.getActualRunMinutes(),op.getProducedQuantity(),op.getScrapQuantity(),op.getReworkQuantity(),op.getDowntimeMinutes(),op.getDowntimeReason(),op.getLaborCostAmount(),op.getOverheadCostAmount())).toList();
        List<WorkOrderMaterialOperationEntity> costOperations=materialOperations.findAllByTenantIdAndWorkOrderIdOrderByCreatedAtAsc(tenantId,order.getId());BigDecimal estimatedMaterial=BigDecimal.ZERO,actualMaterial=BigDecimal.ZERO;int unpricedLines=0;
        for(WorkOrderMaterialEntity line:materialLines){if(line.getEstimatedUnitCost()==null)unpricedLines++;else estimatedMaterial=estimatedMaterial.add(line.getEstimatedUnitCost().multiply(BigDecimal.valueOf(line.getRequiredQuantity())).setScale(2,RoundingMode.HALF_UP));List<WorkOrderMaterialOperationEntity> lineCostOps=costOperations.stream().filter(operation->operation.getMaterialLineId().equals(line.getId())).toList();boolean unknownOpenIssue=false;for(var operation:lineCostOps){if(operation.getUnitCost()==null){if("ISSUE".equals(operation.getOperation()))unknownOpenIssue=true;continue;}if(operation.getCostAmount()!=null)actualMaterial=actualMaterial.add("ISSUE".equals(operation.getOperation())?operation.getCostAmount():operation.getCostAmount().negate());}if(unknownOpenIssue&&line.getUnreturnedIssuedQuantity()>0)unpricedLines++;}
        BigDecimal estimatedLabor=BigDecimal.ZERO,actualLabor=BigDecimal.ZERO,estimatedOverhead=BigDecimal.ZERO,actualOverhead=BigDecimal.ZERO;
        for(var operation:orderOperations){BigDecimal plannedHours=BigDecimal.valueOf(operation.getSetupMinutes()).add(operation.getRunMinutesPerUnit().multiply(BigDecimal.valueOf(order.getTargetQuantity()))).divide(BigDecimal.valueOf(60),8,RoundingMode.HALF_UP);estimatedLabor=estimatedLabor.add(plannedHours.multiply(operation.getLaborRatePerHour()));estimatedOverhead=estimatedOverhead.add(plannedHours.multiply(operation.getOverheadRatePerHour()));if(operation.getLaborCostAmount()!=null)actualLabor=actualLabor.add(operation.getLaborCostAmount());if(operation.getOverheadCostAmount()!=null)actualOverhead=actualOverhead.add(operation.getOverheadCostAmount());}
        estimatedMaterial=estimatedMaterial.setScale(2,RoundingMode.HALF_UP);actualMaterial=actualMaterial.setScale(2,RoundingMode.HALF_UP);estimatedLabor=estimatedLabor.setScale(2,RoundingMode.HALF_UP);actualLabor=actualLabor.setScale(2,RoundingMode.HALF_UP);estimatedOverhead=estimatedOverhead.setScale(2,RoundingMode.HALF_UP);actualOverhead=actualOverhead.setScale(2,RoundingMode.HALF_UP);
        return new ManufacturingDtos.WorkOrderView(order.getId(),order.getOrderNumber(),order.getStatus(),bom.getId(),bom.getRevision(),finished.getId(),finished.getSku(),finished.getName(),order.getOutputWarehouse().getId(),order.getOutputWarehouse().getName(),order.getTargetQuantity(),order.getGoodQuantity(),order.getScrapQuantity(),order.getReworkQuantity(),order.getPlannedStart(),order.getDueDate(),order.getPriority(),materialViews,operationViews,estimatedMaterial,actualMaterial,actualMaterial.subtract(estimatedMaterial).setScale(2,RoundingMode.HALF_UP),unpricedLines,"Material estimate uses weighted accepted purchase prices; labor and overhead use snapshotted work-center hourly rates and recorded job-card minutes.",estimatedLabor,actualLabor,estimatedOverhead,actualOverhead);
    }
    private WorkOrderEntity find(UUID tenantId,UUID id){return orders.findById(id).filter(w->w.getTenantId().equals(tenantId)).orElseThrow(()->notFound("Work order not found"));}
    private WorkOrderEntity lockOrder(UUID tenantId,UUID id){return orders.findForUpdate(tenantId,id).orElseThrow(()->notFound("Work order not found"));}
    private WorkOrderMaterialEntity findMaterial(UUID tenantId,UUID orderId,UUID lineId){return materials.findByTenantIdAndWorkOrderIdAndId(tenantId,orderId,lineId).orElseThrow(()->notFound("Work order material line not found"));}
    private ItemEntity lockItem(UUID tenantId,UUID id){ItemEntity item=items.findForUpdate(tenantId,id).orElseThrow(()->notFound("Item not found in this workspace"));if(!item.isActive())throw conflict("Item is inactive");return item;}
    private ItemEntity item(UUID tenantId,UUID id){return items.findByTenantIdAndId(tenantId,id).orElseThrow(()->notFound("Item not found in this workspace"));}
    private String normalizePriority(String value){String priority=value==null||value.isBlank()?"NORMAL":value.trim().toUpperCase(Locale.ROOT);if(!Set.of("LOW","NORMAL","HIGH","URGENT").contains(priority))throw badRequest("Priority must be LOW, NORMAL, HIGH, or URGENT");return priority;}
    private ResponseStatusException notFound(String msg){return new NotFoundException(msg);}private ResponseStatusException conflict(String msg){return new ConflictException(msg);}private ResponseStatusException badRequest(String msg){return new BadRequestException(msg);}
}
