package si.spindl.manufacturing;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import java.time.LocalDate;
import java.util.*;

@Service
public class BomService {
    private final BomRepository boms; private final BomLineRepository lines; private final BomOperationRepository operations; private final WorkCenterRepository centers; private final ItemRepository items; private final TenantAuditEventRepository audit; private final BomRevisionEventRepository history;
    public BomService(BomRepository boms,BomLineRepository lines,BomOperationRepository operations,WorkCenterRepository centers,ItemRepository items,TenantAuditEventRepository audit,BomRevisionEventRepository history){this.boms=boms;this.lines=lines;this.operations=operations;this.centers=centers;this.items=items;this.audit=audit;this.history=history;}

    @Transactional(readOnly=true)
    public List<ManufacturingDtos.BomView> list(UUID tenantId){return boms.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(b->view(tenantId,b)).toList();}

    @Transactional
    public ManufacturingDtos.BomView create(UUID tenantId,UUID actorId,ManufacturingDtos.CreateBomRequest request){
        ItemEntity finished=item(tenantId,request.finishedItemId());
        if(!finished.isActive())throw conflict("Finished item is inactive");
        String revision=request.revision().trim();
        if(boms.existsByTenantIdAndFinishedItemIdAndRevision(tenantId,finished.getId(),revision))throw conflict("BOM revision already exists for this finished item");
        LocalDate from=request.effectiveFrom()==null?LocalDate.now():request.effectiveFrom();
        if(request.effectiveTo()!=null&&request.effectiveTo().isBefore(from))throw badRequest("Effective-to date must not be before effective-from date");
        validateLines(tenantId,finished.getId(),null,request.lines());
        BomEntity bom=boms.save(new BomEntity(tenantId,finished.getId(),revision,from,request.effectiveTo()));
        lines.saveAll(request.lines().stream().map(line->new BomLineEntity(tenantId,bom.getId(),line.componentItemId(),line.quantityPerUnit(),line.scrapAllowancePercent(),normalizeAlternativeGroup(line.alternativeGroup()))).toList());
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"BOM_CREATED","bom",bom.getId(),Map.of("revision",revision,"finishedSku",finished.getSku())));
        recordHistory(tenantId,bom,actorId,"CREATED",null,"DRAFT");
        return view(tenantId,bom);
    }

    @Transactional
    public ManufacturingDtos.BomView updateDraft(UUID tenantId,UUID actorId,UUID id,ManufacturingDtos.UpdateBomRequest request){
        BomEntity bom=boms.findForUpdate(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"BOM not found"));
        if(!bom.getStatus().equals("DRAFT"))throw conflict("Only draft BOM revisions can be edited");
        LocalDate from=request.effectiveFrom()==null?bom.getEffectiveFrom():request.effectiveFrom();
        if(request.effectiveTo()!=null&&request.effectiveTo().isBefore(from))throw badRequest("Effective-to date must not be before effective-from date");
        validateLines(tenantId,bom.getFinishedItemId(),bom.getId(),request.lines());
        String previous=bom.getStatus();bom.updateDraft(from,request.effectiveTo());
        var priorLines=lines.findAllByTenantIdAndBomIdOrderById(tenantId,id);lines.deleteAll(priorLines);lines.flush();
        lines.saveAll(request.lines().stream().map(line->new BomLineEntity(tenantId,id,line.componentItemId(),line.quantityPerUnit(),line.scrapAllowancePercent(),normalizeAlternativeGroup(line.alternativeGroup()))).toList());
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"BOM_UPDATED","bom",id,Map.of("revision",bom.getRevision())));
        recordHistory(tenantId,bom,actorId,"UPDATED",previous,bom.getStatus());
        return view(tenantId,bom);
    }

    @Transactional(readOnly=true)
    public List<ManufacturingDtos.BomHistoryView> history(UUID tenantId,UUID id){
        if(boms.findByTenantIdAndId(tenantId,id).isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"BOM not found");
        return history.findAllByTenantIdAndBomIdOrderByCreatedAtDesc(tenantId,id).stream().map(e->new ManufacturingDtos.BomHistoryView(e.getId(),e.getEventType(),e.getPreviousStatus(),e.getNewStatus(),e.getActorUserId(),e.getCreatedAt())).toList();
    }

    @Transactional
    public ManufacturingDtos.BomView approve(UUID tenantId,UUID actorId,UUID id){
        BomEntity bom=boms.findForUpdate(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"BOM not found"));
        if(bom.getStatus().equals("APPROVED"))return view(tenantId,bom);
        if(!bom.getStatus().equals("DRAFT"))throw conflict("Only draft BOM revisions can be approved");
        if(lines.findAllByTenantIdAndBomIdOrderById(tenantId,id).isEmpty())throw badRequest("Add at least one component before approving this BOM");
        for(var operation:operations.findAllByTenantIdAndBomIdOrderBySequenceAsc(tenantId,id)){var center=centers.findByTenantIdAndId(tenantId,operation.getWorkCenterId()).orElseThrow(()->conflict("A routing work center is missing"));if(!center.isActive())throw conflict("Activate the work center before approving this BOM");}
        LocalDate today=LocalDate.now();
        if(bom.getEffectiveFrom().isAfter(today)||(bom.getEffectiveTo()!=null&&bom.getEffectiveTo().isBefore(today)))throw conflict("BOM is not effective today");
        for(BomEntity prior:boms.findAllByTenantIdAndFinishedItemIdAndStatusOrderByEffectiveFromDesc(tenantId,bom.getFinishedItemId(),"APPROVED")){
            if(!prior.getId().equals(id)){prior.obsolete();recordHistory(tenantId,prior,actorId,"OBSOLETED","APPROVED","OBSOLETE");audit.save(new TenantAuditEventEntity(tenantId,actorId,"BOM_OBSOLETED","bom",prior.getId(),Map.of("supersededBy",bom.getRevision())));}
        }
        bom.approve();
        recordHistory(tenantId,bom,actorId,"APPROVED","DRAFT","APPROVED");
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"BOM_APPROVED","bom",id,Map.of("revision",bom.getRevision())));
        return view(tenantId,bom);
    }

    private ManufacturingDtos.BomView view(UUID tenantId,BomEntity bom){
        ItemEntity finished=item(tenantId,bom.getFinishedItemId());
        var lineViews=lines.findAllByTenantIdAndBomIdOrderById(tenantId,bom.getId()).stream().map(line->{ItemEntity component=item(tenantId,line.getComponentItemId());return new ManufacturingDtos.BomLineView(line.getId(),component.getId(),component.getSku(),component.getName(),component.getUnit(),line.getQuantityPerUnit(),line.getScrapAllowancePercent(),line.getAlternativeGroup());}).toList();
        var operationViews=operations.findAllByTenantIdAndBomIdOrderBySequenceAsc(tenantId,bom.getId()).stream().map(op->{var center=centers.findByTenantIdAndId(tenantId,op.getWorkCenterId()).orElseThrow();return new ManufacturingDtos.BomOperationView(op.getId(),op.getSequence(),op.getName(),center.getId(),center.getCode(),center.getName(),op.getSetupMinutes(),op.getRunMinutesPerUnit(),op.getSkillRequirements());}).toList();
        return new ManufacturingDtos.BomView(bom.getId(),finished.getId(),finished.getSku(),finished.getName(),bom.getRevision(),bom.getStatus(),bom.getEffectiveFrom(),bom.getEffectiveTo(),lineViews,operationViews);
    }
    private ItemEntity item(UUID tenantId,UUID itemId){return items.findByTenantIdAndId(tenantId,itemId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Item not found in this workspace"));}
    private Map<UUID,Set<UUID>> componentGraph(UUID tenantId,UUID excludedBom){var graph=new HashMap<UUID,Set<UUID>>();for(var bom:boms.findAllByTenantIdOrderByCreatedAtDesc(tenantId)){if(Objects.equals(bom.getId(),excludedBom))continue;for(var line:lines.findAllByTenantIdAndBomIdOrderById(tenantId,bom.getId()))graph.computeIfAbsent(bom.getFinishedItemId(),k->new HashSet<>()).add(line.getComponentItemId());}return graph;}
    private void validateLines(UUID tenantId,UUID finishedId,UUID excludedBom,List<ManufacturingDtos.BomLineRequest> requests){var graph=componentGraph(tenantId,excludedBom);var componentIds=new HashSet<UUID>();var alternativeCounts=new HashMap<String,Integer>();for(var line:requests){ItemEntity component=item(tenantId,line.componentItemId());if(!component.isActive())throw conflict("BOM components must be active items");if(!componentIds.add(component.getId()))throw badRequest("Each component may appear only once in a BOM revision");String group=normalizeAlternativeGroup(line.alternativeGroup());if(group!=null)alternativeCounts.merge(group,1,Integer::sum);if(component.getId().equals(finishedId)||reaches(graph,component.getId(),finishedId))throw conflict("BOM would create a component cycle");}if(alternativeCounts.values().stream().anyMatch(count->count<2))throw badRequest("Each alternate component group must contain at least two components");}
    private String normalizeAlternativeGroup(String value){if(value==null||value.isBlank())return null;String normalized=value.trim().toUpperCase(Locale.ROOT);if(normalized.length()>40)throw badRequest("Alternate group names can be at most 40 characters");return normalized;}
    private void recordHistory(UUID tenantId,BomEntity bom,UUID actorId,String event,String previous,String next){history.save(new BomRevisionEventEntity(tenantId,bom.getId(),actorId,event,previous,next));}
    private boolean reaches(Map<UUID,Set<UUID>> graph,UUID from,UUID target){var seen=new HashSet<UUID>();var stack=new ArrayDeque<UUID>();stack.push(from);while(!stack.isEmpty()){UUID current=stack.pop();if(current.equals(target))return true;if(seen.add(current))for(UUID next:graph.getOrDefault(current,Set.of()))stack.push(next);}return false;}
    private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}private ResponseStatusException badRequest(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
