package si.spindl.inventory;

import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantRolePermissionRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.identity.TenantMembershipBranchRepository;
import si.spindl.identity.TenantMembershipEntity;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class InventoryCycleCountService {
    private final InventoryCycleCountRepository counts;
    private final InventoryCycleCountLineRepository lines;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final TenantAuditEventRepository audit;
    private final DevelopmentTenant tenant;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    private final TenantRolePermissionRepository permissions;
    private final TenantMembershipRepository memberships;
    private final TenantMembershipBranchRepository memberBranches;

    public InventoryCycleCountService(InventoryCycleCountRepository counts,InventoryCycleCountLineRepository lines,ItemRepository items,InventoryMovementRepository movements,TenantAuditEventRepository audit,DevelopmentTenant tenant,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock,TenantRolePermissionRepository permissions,TenantMembershipRepository memberships,TenantMembershipBranchRepository memberBranches){this.counts=counts;this.lines=lines;this.items=items;this.movements=movements;this.audit=audit;this.tenant=tenant;this.warehouses=warehouses;this.warehouseStock=warehouseStock;this.permissions=permissions;this.memberships=memberships;this.memberBranches=memberBranches;}

    @Transactional(readOnly=true)
    public List<CycleCountView> list(UUID actorId){UUID tenantId=tenant.currentTenantId();String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Workspace membership is inactive"));java.util.LinkedHashMap<UUID,InventoryCycleCountEntity> visible=new java.util.LinkedHashMap<>();if(permissions.allows(tenantId,role,"inventory","cycle-counts","view","ALL"))counts.findAllByTenantIdOrderByCreatedAtDesc(tenantId).forEach(c->visible.put(c.getId(),c));else{if(permissions.allows(tenantId,role,"inventory","cycle-counts","view","OWN"))counts.findAllByTenantIdAndCreatedByOrderByCreatedAtDesc(tenantId,actorId).forEach(c->visible.put(c.getId(),c));if(permissions.allows(tenantId,role,"inventory","cycle-counts","view","TEAM")){List<UUID> owners=new java.util.ArrayList<>();owners.add(actorId);memberships.findAllByTenantIdAndManagerUserIdAndActiveTrueOrderByCreatedAtAsc(tenantId,actorId).stream().map(TenantMembershipEntity::getUserId).forEach(owners::add);counts.findAllByTenantIdAndCreatedByInOrderByCreatedAtDesc(tenantId,owners).forEach(c->visible.put(c.getId(),c));}if(permissions.allows(tenantId,role,"inventory","cycle-counts","view","BRANCH")){List<UUID> branchIds=memberBranches.findActiveBranchIds(tenantId,actorId);if(!branchIds.isEmpty())counts.findAllByTenantAndBranchIds(tenantId,branchIds).forEach(c->visible.put(c.getId(),c));}}return visible.values().stream().sorted(java.util.Comparator.comparing(InventoryCycleCountEntity::getCreatedAt).reversed()).map(count->view(tenantId,count)).toList();}

    @Transactional
    public CycleCountView create(UUID actorId,CreateCycleCountRequest request){UUID tenantId=tenant.currentTenantId();String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Workspace membership is inactive"));boolean all=permissions.allows(tenantId,role,"inventory","cycle-counts","create","ALL"),own=permissions.allows(tenantId,role,"inventory","cycle-counts","create","OWN"),team=permissions.allows(tenantId,role,"inventory","cycle-counts","create","TEAM"),branch=permissions.allows(tenantId,role,"inventory","cycle-counts","create","BRANCH");if(!(all||own||team||branch))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Cycle count creation is not permitted");if(counts.existsByTenantIdAndStatusIn(tenantId,List.of("COUNTING","REVIEW")))throw conflict("Finish or cancel the open cycle count before starting another");WarehouseEntity warehouse=(request.warehouseId()==null?warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId):warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,request.warehouseId())).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an active warehouse"));if(!all&&branch&&!team&&!own&&!memberBranches.hasActiveAssignment(tenantId,actorId,warehouse.getBranchId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You are not assigned to the selected warehouse branch");String name=request.name().trim();var count=counts.saveAndFlush(new InventoryCycleCountEntity(tenantId,name,request.notes()==null?null:request.notes().trim(),actorId,warehouse));var snapshots=items.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream().map(item->{var balance=warehouseStock.findByLocationAndItem(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->conflict("Stock balance is missing for "+item.getSku()));return new InventoryCycleCountLineEntity(tenantId,count.getId(),item,balance.getOnHand());}).toList();if(snapshots.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"There are no active items to count");lines.saveAll(snapshots);audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_CYCLE_COUNT_CREATED","inventory_cycle_count",count.getId(),Map.of("name",name,"warehouse",warehouse.getCode(),"itemCount",snapshots.size())));return view(tenantId,count);}

    @Transactional
    public CycleCountView record(UUID actorId,UUID countId,UUID lineId,RecordCountRequest request){UUID tenantId=tenant.currentTenantId();var count=lock(actorId,tenantId,countId,"update");if(!count.getStatus().equals("COUNTING"))throw conflict("Counts can only be entered while the session is counting");var line=lines.findByTenantIdAndCycleCountIdAndId(tenantId,countId,lineId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Count line not found"));line.count(request.countedQuantity());audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_CYCLE_COUNT_LINE_RECORDED","inventory_cycle_count_line",lineId,Map.of("countedQuantity",request.countedQuantity())));return view(tenantId,count);}

    @Transactional
    public CycleCountView submit(UUID actorId,UUID countId){UUID tenantId=tenant.currentTenantId();var count=lock(actorId,tenantId,countId,"update");if(!count.getStatus().equals("COUNTING"))throw conflict("Only a counting session can be submitted for review");var sessionLines=lines.findAllByTenantIdAndCycleCountIdOrderBySkuAsc(tenantId,countId);if(sessionLines.isEmpty()||sessionLines.stream().anyMatch(line->line.getCountedQuantity()==null))throw conflict("Enter a counted quantity for every item before submitting");count.submit();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_CYCLE_COUNT_SUBMITTED","inventory_cycle_count",countId,Map.of("itemCount",sessionLines.size())));return view(tenantId,count);}

    @Transactional
    public CycleCountView approve(UUID actorId,UUID countId){UUID tenantId=tenant.currentTenantId();var count=lock(actorId,tenantId,countId,"approve");if(count.getStatus().equals("POSTED"))return view(tenantId,count);if(!count.getStatus().equals("REVIEW"))throw conflict("Submit the count for review before posting variances");var sessionLines=lines.findAllByTenantIdAndCycleCountIdOrderBySkuAsc(tenantId,countId);int posted=0;
        for(var line:sessionLines){int variance=line.getVariance();if(variance==0)continue;var item=items.findForUpdate(tenantId,line.getItemId()).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"A counted item no longer exists"));var balance=warehouseStock.findForUpdate(tenantId,count.getWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Stock balance is missing for "+line.getSku()));if(balance.getOnHand()!=line.getSystemQuantity())throw conflict("Stock changed for "+line.getSku()+" after the count began. Cancel this session and recount it.");try{balance.adjustStock(variance);}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Cannot reduce "+line.getSku()+" below its reserved, allocated, or quality-held quantity: "+exception.getMessage());}try{if(count.getWarehouse().isDefault())item.adjustStock(variance);else item.adjustStockInExternalWarehouse(variance);}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Cannot post variance for "+line.getSku()+": "+exception.getMessage());}String key="cycle-count:"+countId+":"+line.getItemId();movements.save(new InventoryMovementEntity(tenantId,item,count.getWarehouse(),variance,"Cycle count: "+count.getName(),"CC-"+countId.toString().substring(0,8).toUpperCase(),key));posted++;}
        count.post();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_CYCLE_COUNT_POSTED","inventory_cycle_count",countId,Map.of("lineCount",sessionLines.size(),"adjustmentsPosted",posted)));return view(tenantId,count);
    }

    @Transactional
    public CycleCountView cancel(UUID actorId,UUID countId){UUID tenantId=tenant.currentTenantId();var count=lock(actorId,tenantId,countId,"delete");if(!List.of("COUNTING","REVIEW").contains(count.getStatus()))throw conflict("This count session can no longer be cancelled");count.cancel();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_CYCLE_COUNT_CANCELLED","inventory_cycle_count",countId,Map.of()));return view(tenantId,count);}

    private CycleCountView view(UUID tenantId,InventoryCycleCountEntity count){List<CycleCountLineView> lineViews=lines.findAllByTenantIdAndCycleCountIdOrderBySkuAsc(tenantId,count.getId()).stream().map(line->new CycleCountLineView(line.getId(),line.getItemId(),line.getSku(),line.getItemName(),line.getUnit(),line.getSystemQuantity(),line.getCountedQuantity(),line.getVariance())).toList();return new CycleCountView(count.getId(),count.getName(),count.getStatus(),count.getNotes(),count.getWarehouse().getId(),count.getWarehouse().getCode(),count.getWarehouse().getName(),count.getCreatedBy(),count.getCreatedAt(),count.getSubmittedAt(),count.getPostedAt(),lineViews);}
    private InventoryCycleCountEntity lock(UUID actorId,UUID tenantId,UUID id,String action){InventoryCycleCountEntity count=counts.findForUpdate(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Cycle count not found"));String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Workspace membership is inactive"));if(permissions.allows(tenantId,role,"inventory","cycle-counts",action,"ALL"))return count;if(permissions.allows(tenantId,role,"inventory","cycle-counts",action,"OWN")&&count.getCreatedBy().equals(actorId))return count;if(permissions.allows(tenantId,role,"inventory","cycle-counts",action,"TEAM")&&(count.getCreatedBy().equals(actorId)||memberships.findAllByTenantIdAndManagerUserIdAndActiveTrueOrderByCreatedAtAsc(tenantId,actorId).stream().anyMatch(member->member.getUserId().equals(count.getCreatedBy()))))return count;if(permissions.allows(tenantId,role,"inventory","cycle-counts",action,"BRANCH")&&memberBranches.hasActiveAssignment(tenantId,actorId,count.getWarehouse().getBranchId()))return count;throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You do not have permission to access this cycle count");}
    private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}

    public record CreateCycleCountRequest(@NotBlank @Size(max=120) String name,@Size(max=500) String notes,UUID warehouseId){}
    public record RecordCountRequest(@NotNull @jakarta.validation.constraints.Min(0) Integer countedQuantity){}
    public record CycleCountLineView(UUID id,UUID itemId,String sku,String itemName,String unit,int systemQuantity,Integer countedQuantity,Integer variance){}
    public record CycleCountView(UUID id,String name,String status,String notes,UUID warehouseId,String warehouseCode,String warehouseName,UUID createdBy,java.time.Instant createdAt,java.time.Instant submittedAt,java.time.Instant postedAt,List<CycleCountLineView> lines){}
}
