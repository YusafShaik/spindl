package si.spindl.inventory;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.common.exception.PayloadTooLargeException;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.tenant.CurrentTenant;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import si.spindl.inventory.InventoryAdjustmentDtos.AdjustmentRequest;
import si.spindl.inventory.InventoryAdjustmentDtos.MovementView;
import si.spindl.inventory.InventoryAdjustmentDtos.MovementSearchPage;

@Service
public class InventoryAdjustmentService {
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final CurrentTenant tenant;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;

    public InventoryAdjustmentService(ItemRepository items,InventoryMovementRepository movements,CurrentTenant tenant,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock){this.items=items;this.movements=movements;this.tenant=tenant;this.warehouses=warehouses;this.warehouseStock=warehouseStock;}

    @Transactional(readOnly=true)
    public List<MovementView> recentMovements(){return movements.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId(),PageRequest.of(0,100)).stream().map(InventoryAdjustmentMapper::toMovementView).toList();}

    @Transactional(readOnly=true)
    public MovementSearchPage searchMovements(UUID itemId,LocalDate from,LocalDate to,String query,int page,int size){
        if(from!=null&&to!=null&&from.isAfter(to))throw new BadRequestException("From date must not be after to date");
        int safePage=Math.max(0,page);int safeSize=Math.min(100,Math.max(1,size));
        var result=movements.findAll(movementSpecification(itemId,from,to,query),PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"createdAt")));
        return new MovementSearchPage(result.getContent().stream().map(InventoryAdjustmentMapper::toMovementView).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }

    @Transactional(readOnly=true)
    public String exportMovements(UUID itemId,LocalDate from,LocalDate to,String query){
        if(from!=null&&to!=null&&from.isAfter(to))throw new BadRequestException("From date must not be after to date");
        Specification<InventoryMovementEntity> specification=movementSpecification(itemId,from,to,query);
        var first=movements.findAll(specification,PageRequest.of(0,1));
        if(first.getTotalElements()>10_000)throw new PayloadTooLargeException("Narrow the filters to export 10,000 movements or fewer");
        var result=movements.findAll(specification,PageRequest.of(0,10_000,Sort.by(Sort.Direction.DESC,"createdAt")));
        return "created_at,warehouse,sku,item,reason,reference,quantity_change\r\n"+result.getContent().stream().map(InventoryAdjustmentMapper::toMovementView).map(movement->String.join(",",
                csv(movement.createdAt().toString()),csv(movement.warehouseName()),csv(movement.sku()),csv(movement.itemName()),csv(movement.reason()),csv(movement.sourceReference()),Integer.toString(movement.quantityDelta()))).collect(Collectors.joining("\r\n"));
    }

    private String csv(String value){
        if(value==null)return "";
        String safe=value.matches("^[\\s]*[=+@-].*")?"'"+value:value;
        return "\""+safe.replace("\"","\"\"")+"\"";
    }

    private Specification<InventoryMovementEntity> movementSpecification(UUID itemId,LocalDate from,LocalDate to,String query){
        Instant fromTime=from==null?null:from.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant untilTime=to==null?null:to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        String search=query==null?"":query.trim().toLowerCase(java.util.Locale.ROOT);
        return (root,criteriaQuery,criteria)->{
            var predicates=new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(criteria.equal(root.get("tenantId"),tenant.currentTenantId()));
            if(itemId!=null)predicates.add(criteria.equal(root.get("item").get("id"),itemId));
            if(fromTime!=null)predicates.add(criteria.greaterThanOrEqualTo(root.get("createdAt"),fromTime));
            if(untilTime!=null)predicates.add(criteria.lessThan(root.get("createdAt"),untilTime));
            if(!search.isEmpty()){
                String pattern="%"+search+"%";
                var item=root.join("item");
                var warehouse=root.join("warehouse",jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(criteria.or(criteria.like(criteria.lower(item.get("sku")),pattern),criteria.like(criteria.lower(item.get("name")),pattern),criteria.like(criteria.lower(root.get("reason")),pattern),criteria.like(criteria.lower(root.get("sourceReference")),pattern),criteria.like(criteria.lower(warehouse.get("code")),pattern),criteria.like(criteria.lower(warehouse.get("name")),pattern)));
            }
            return criteria.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    @Transactional
    public MovementView adjust(AdjustmentRequest request){
        UUID tenantId=tenant.currentTenantId();
        if(request.quantityDelta()==0||request.quantityDelta()==Integer.MIN_VALUE)throw new BadRequestException("Adjustment must be a non-zero whole number");
        String reason=request.reason().trim();
        WarehouseEntity warehouse=(request.warehouseId()==null?warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId):warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,request.warehouseId())).orElseThrow(()->new BadRequestException("Choose an active warehouse"));
        InventoryMovementEntity existing=movements.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),warehouse.getId(),request.quantityDelta(),reason))throw new ConflictException("Idempotency key was reused with different adjustment details");return InventoryAdjustmentMapper.toMovementView(existing);}
        ItemEntity item=items.findActiveForUpdate(tenantId,request.itemId()).orElseThrow(()->new NotFoundException("Active item not found"));
        existing=movements.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),warehouse.getId(),request.quantityDelta(),reason))throw new ConflictException("Idempotency key was reused with different adjustment details");return InventoryAdjustmentMapper.toMovementView(existing);}
        WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->new ConflictException("Stock balance is missing"));
        try{balance.adjustStock(request.quantityDelta());}catch(IllegalArgumentException|ArithmeticException exception){throw new ConflictException("Adjustment exceeds stock available at "+warehouse.getName()+": "+exception.getMessage());}
        try{if(warehouse.isDefault())item.adjustStock(request.quantityDelta());else item.adjustStockInExternalWarehouse(request.quantityDelta());}catch(ArithmeticException|IllegalArgumentException exception){throw new ConflictException(exception.getMessage());}
        String reference="ADJ-"+UUID.randomUUID().toString().substring(0,12).toUpperCase(java.util.Locale.ROOT);
        InventoryMovementEntity movement=new InventoryMovementEntity(tenantId,item,warehouse,request.quantityDelta(),reason,reference,request.idempotencyKey());
        try{return InventoryAdjustmentMapper.toMovementView(movements.saveAndFlush(movement));}
        catch(DataIntegrityViolationException exception){throw new ConflictException("Adjustment request already exists; retry with its idempotency key");}
    }

}
