package si.spindl.quality;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import si.spindl.quality.QualityDtos.SetInspectionRequest;
import si.spindl.quality.QualityDtos.InspectRequest;
import si.spindl.quality.QualityDtos.ItemQualityView;
import si.spindl.quality.QualityDtos.QualityLotView;

@Service
public class QualityService {
    private final CurrentTenant tenant;private final ItemRepository items;private final QualityLotRepository lots;private final QualityInspectionRepository inspections;private final InventoryMovementRepository movements;private final TenantAuditEventRepository audit;private final WarehouseStockRepository warehouseStock;
    public QualityService(CurrentTenant tenant,ItemRepository items,QualityLotRepository lots,QualityInspectionRepository inspections,InventoryMovementRepository movements,TenantAuditEventRepository audit,WarehouseStockRepository warehouseStock){this.tenant=tenant;this.items=items;this.lots=lots;this.inspections=inspections;this.movements=movements;this.audit=audit;this.warehouseStock=warehouseStock;}

    @Transactional(readOnly=true)
    public List<ItemQualityView> items(){UUID tenantId=tenant.currentTenantId();return items.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream().map(item->new ItemQualityView(item.getId(),item.getSku(),item.getName(),item.getUnit(),item.isQualityInspectionRequired(),item.getOnHand(),item.getQualityHoldQuantity(),item.getAvailableQuantity())).toList();}

    @Transactional
    public ItemQualityView setInspectionRequired(UUID actorId,UUID itemId,SetInspectionRequest request){UUID tenantId=tenant.currentTenantId();var item=items.findForUpdate(tenantId,itemId).orElseThrow(()->notFound("Item not found"));if(item.isQualityInspectionRequired()==request.required())return itemView(item);if(request.required()){if(item.getReservedQuantity()+item.getManufacturingReservedQuantity()>0)throw conflict("Release existing reservations before enabling inspection");int openingQuantity=item.getOnHand();item.setQualityInspectionRequired(true);if(openingQuantity>0){item.addExistingStockToQualityHold(openingQuantity);for(var balance:warehouseStock.findAllByTenantAndItem(tenantId,itemId)){if(balance.getOnHand()>0){balance.addQualityHold(balance.getOnHand());lots.save(new QualityLotEntity(tenantId,item,balance.getWarehouse(),"OPENING_STOCK","ITEM-"+itemId+"/"+balance.getWarehouse().getCode(),balance.getOnHand()));}}}}else{if(item.getQualityHoldQuantity()>0)throw conflict("Inspect and release held stock before disabling inspection");item.setQualityInspectionRequired(false);}audit.save(new TenantAuditEventEntity(tenantId,actorId,"QUALITY_INSPECTION_REQUIREMENT_CHANGED","item",itemId,Map.of("required",request.required())));return itemView(item);}

    @Transactional(readOnly=true)
    public List<QualityLotView> lots(){UUID tenantId=tenant.currentTenantId();return lots.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::view).toList();}

    @Transactional
    public QualityLotView inspect(UUID actorId,UUID lotId,InspectRequest request){UUID tenantId=tenant.currentTenantId();String outcome=request.outcome().trim().toUpperCase(java.util.Locale.ROOT);if(!List.of("PASS","FAIL").contains(outcome))throw new BadRequestException("Outcome must be PASS or FAIL");String key=request.idempotencyKey().trim();String notes=request.notes()==null?null:request.notes().trim();var prior=inspections.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);if(prior!=null){if(!prior.matches(lotId,outcome,request.quantity(),notes))throw conflict("Idempotency key was already used for another inspection");return lots.findByTenantIdAndId(tenantId,lotId).map(this::view).orElseThrow(()->notFound("Quality lot not found"));}
        var lot=lots.findForUpdate(tenantId,lotId).orElseThrow(()->notFound("Quality lot not found"));prior=inspections.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);if(prior!=null){if(!prior.matches(lotId,outcome,request.quantity(),notes))throw conflict("Idempotency key was already used for another inspection");return view(lot);}if(lot.getRemainingQuantity()==0)throw conflict("This quality lot has already been fully inspected");var item=items.findForUpdate(tenantId,lot.getItem().getId()).orElseThrow(()->notFound("Quality item not found"));var balance=warehouseStock.findForUpdate(tenantId,lot.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Quality stock balance is missing"));try{lot.inspect(outcome,request.quantity());if(outcome.equals("PASS")){item.releaseQualityHold(request.quantity());balance.releaseQualityHold(request.quantity());}else{item.rejectQualityHold(request.quantity());balance.rejectQualityHold(request.quantity());String movementKey="QC-"+UUID.nameUUIDFromBytes(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));movements.save(new InventoryMovementEntity(tenantId,item,lot.getWarehouse(),-request.quantity(),"Quality rejection",lot.getSourceReference()+"/QC",movementKey));}}catch(IllegalArgumentException|ArithmeticException exception){throw conflict(exception.getMessage());}
        inspections.save(new QualityInspectionEntity(tenantId,lotId,outcome,request.quantity(),notes,actorId,key));audit.save(new TenantAuditEventEntity(tenantId,actorId,"QUALITY_INSPECTION_RECORDED","quality_lot",lotId,Map.of("outcome",outcome,"quantity",request.quantity())));return view(lot);
    }

    private ItemQualityView itemView(ItemEntity item){return new ItemQualityView(item.getId(),item.getSku(),item.getName(),item.getUnit(),item.isQualityInspectionRequired(),item.getOnHand(),item.getQualityHoldQuantity(),item.getAvailableQuantity());}
    private QualityLotView view(QualityLotEntity lot){ItemEntity item=lot.getItem();return new QualityLotView(lot.getId(),item.getId(),item.getSku(),item.getName(),lot.getWarehouse().getCode(),lot.getWarehouse().getName(),lot.getSourceType(),lot.getSourceReference(),lot.getQuantity(),lot.getRemainingQuantity(),lot.getPassedQuantity(),lot.getRejectedQuantity(),lot.getStatus(),lot.getCreatedAt());}
    private ResponseStatusException notFound(String text){return new NotFoundException(text);}private ResponseStatusException conflict(String text){return new ConflictException(text);}
}
