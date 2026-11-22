package si.spindl.manufacturing;
import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
@Service
public class BomRoutingService {
    private final BomRepository boms;private final BomOperationRepository operations;private final WorkCenterRepository centers;private final TenantAuditEventRepository audit;private final BomRevisionEventRepository history;
    public BomRoutingService(BomRepository boms,BomOperationRepository operations,WorkCenterRepository centers,TenantAuditEventRepository audit,BomRevisionEventRepository history){this.boms=boms;this.operations=operations;this.centers=centers;this.audit=audit;this.history=history;}
    @Transactional
    public List<ManufacturingDtos.BomOperationView> replace(UUID tenantId,UUID actorId,UUID bomId,ManufacturingDtos.UpdateRoutingRequest request){
        var bom=boms.findForUpdate(tenantId,bomId).orElseThrow(()->new NotFoundException("BOM not found"));
        if(!bom.getStatus().equals("DRAFT"))throw new ConflictException("Routing is locked after BOM approval");
        var sequences=new HashSet<Integer>();
        for(var operation:request.operations()){
            if(!sequences.add(operation.sequence()))throw new BadRequestException("Operation sequence numbers must be unique");
            var center=centers.findByTenantIdAndId(tenantId,operation.workCenterId()).orElseThrow(()->new BadRequestException("Select a work center in this workspace"));
            if(!center.isActive())throw new ConflictException("Routing can only use active work centers");
        }
        var prior=operations.findAllByTenantIdAndBomIdOrderBySequenceAsc(tenantId,bomId);operations.deleteAll(prior);operations.flush();
        var saved=operations.saveAll(request.operations().stream().map(op->new BomOperationEntity(tenantId,bomId,op.sequence(),op.name().trim(),op.workCenterId(),op.setupMinutes(),op.runMinutesPerUnit(),op.skillRequirements()==null?null:op.skillRequirements().trim())).toList());
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"BOM_ROUTING_UPDATED","bom",bomId,java.util.Map.of("operationCount",saved.size())));
        history.save(new BomRevisionEventEntity(tenantId,bomId,actorId,"UPDATED","DRAFT","DRAFT"));
        return view(tenantId,bomId);
    }
    @Transactional(readOnly=true)
    public List<ManufacturingDtos.BomOperationView> list(UUID tenantId,UUID bomId){if(boms.findByTenantIdAndId(tenantId,bomId).isEmpty())throw new NotFoundException("BOM not found");return view(tenantId,bomId);}
    private List<ManufacturingDtos.BomOperationView> view(UUID tenantId,UUID bomId){return operations.findAllByTenantIdAndBomIdOrderBySequenceAsc(tenantId,bomId).stream().map(op->{var center=centers.findByTenantIdAndId(tenantId,op.getWorkCenterId()).orElseThrow();return new ManufacturingDtos.BomOperationView(op.getId(),op.getSequence(),op.getName(),center.getId(),center.getCode(),center.getName(),op.getSetupMinutes(),op.getRunMinutesPerUnit(),op.getSkillRequirements());}).toList();}
}
