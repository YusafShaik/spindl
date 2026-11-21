package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class InventoryAdjustmentService {
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final DevelopmentTenant tenant;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;

    public InventoryAdjustmentService(ItemRepository items,InventoryMovementRepository movements,DevelopmentTenant tenant,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock){this.items=items;this.movements=movements;this.tenant=tenant;this.warehouses=warehouses;this.warehouseStock=warehouseStock;}

    @Transactional(readOnly=true)
    public List<MovementView> recentMovements(){return movements.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId(),PageRequest.of(0,100)).stream().map(MovementView::from).toList();}

    @Transactional(readOnly=true)
    public MovementSearchPage searchMovements(UUID itemId,LocalDate from,LocalDate to,String query,int page,int size){
        if(from!=null&&to!=null&&from.isAfter(to))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"From date must not be after to date");
        int safePage=Math.max(0,page);int safeSize=Math.min(100,Math.max(1,size));
        var result=movements.findAll(movementSpecification(itemId,from,to,query),PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"createdAt")));
        return new MovementSearchPage(result.getContent().stream().map(MovementView::from).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }

    @Transactional(readOnly=true)
    public String exportMovements(UUID itemId,LocalDate from,LocalDate to,String query){
        if(from!=null&&to!=null&&from.isAfter(to))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"From date must not be after to date");
        Specification<InventoryMovementEntity> specification=movementSpecification(itemId,from,to,query);
        var first=movements.findAll(specification,PageRequest.of(0,1));
        if(first.getTotalElements()>10_000)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Narrow the filters to export 10,000 movements or fewer");
        var result=movements.findAll(specification,PageRequest.of(0,10_000,Sort.by(Sort.Direction.DESC,"createdAt")));
        return "created_at,warehouse,sku,item,reason,reference,quantity_change\r\n"+result.getContent().stream().map(MovementView::from).map(movement->String.join(",",
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
        if(request.quantityDelta()==0||request.quantityDelta()==Integer.MIN_VALUE)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Adjustment must be a non-zero whole number");
        String reason=request.reason().trim();
        WarehouseEntity warehouse=(request.warehouseId()==null?warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId):warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,request.warehouseId())).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an active warehouse"));
        InventoryMovementEntity existing=movements.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),warehouse.getId(),request.quantityDelta(),reason))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was reused with different adjustment details");return MovementView.from(existing);}
        ItemEntity item=items.findActiveForUpdate(tenantId,request.itemId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Active item not found"));
        existing=movements.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),warehouse.getId(),request.quantityDelta(),reason))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was reused with different adjustment details");return MovementView.from(existing);}
        WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Stock balance is missing"));
        try{balance.adjustStock(request.quantityDelta());}catch(IllegalArgumentException|ArithmeticException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"Adjustment exceeds stock available at "+warehouse.getName()+": "+exception.getMessage());}
        try{if(warehouse.isDefault())item.adjustStock(request.quantityDelta());else item.adjustStockInExternalWarehouse(request.quantityDelta());}catch(ArithmeticException|IllegalArgumentException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,exception.getMessage());}
        String reference="ADJ-"+UUID.randomUUID().toString().substring(0,12).toUpperCase(java.util.Locale.ROOT);
        InventoryMovementEntity movement=new InventoryMovementEntity(tenantId,item,warehouse,request.quantityDelta(),reason,reference,request.idempotencyKey());
        try{return MovementView.from(movements.saveAndFlush(movement));}
        catch(DataIntegrityViolationException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"Adjustment request already exists; retry with its idempotency key");}
    }

    public record AdjustmentRequest(@NotNull UUID itemId,@NotNull Integer quantityDelta,@NotBlank @Size(max=80) String reason,@NotBlank @Size(max=120) String idempotencyKey,UUID warehouseId){}
    public record MovementView(UUID id,UUID itemId,String sku,String itemName,UUID warehouseId,String warehouseCode,String warehouseName,int quantityDelta,String reason,String sourceReference,Instant createdAt){
        static MovementView from(InventoryMovementEntity movement){WarehouseEntity warehouse=movement.getWarehouse();return new MovementView(movement.getId(),movement.getItem().getId(),movement.getItem().getSku(),movement.getItem().getName(),warehouse==null?null:warehouse.getId(),warehouse==null?null:warehouse.getCode(),warehouse==null?null:warehouse.getName(),movement.getQuantityDelta(),movement.getReason(),movement.getSourceReference(),movement.getCreatedAt());}
    }
    public record MovementSearchPage(List<MovementView> items,int page,int pageSize,long totalElements,int totalPages){}
}
