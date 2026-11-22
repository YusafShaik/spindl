package si.spindl.pos;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantMembershipBranchRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.quality.QualityLotEntity;
import si.spindl.quality.QualityLotRepository;
import si.spindl.tenant.CurrentTenant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import si.spindl.pos.PosRefundDtos.RefundLineRequest;
import si.spindl.pos.PosRefundDtos.RefundTenderRequest;
import si.spindl.pos.PosRefundDtos.RefundRequest;
import si.spindl.pos.PosRefundDtos.RefundLineView;
import si.spindl.pos.PosRefundDtos.RefundTenderView;
import si.spindl.pos.PosRefundDtos.RefundView;

@Service
public class PosRefundService {
    private static final Set<String> DISPOSITIONS=Set.of("RESTOCK","QUARANTINE","SCRAP");
    private final CurrentTenant tenant;private final TenantMembershipRepository memberships;private final TenantMembershipBranchRepository branches;private final PosSaleRepository sales;private final PosRegisterSessionRepository sessions;private final PosSaleLineRepository saleLines;private final PosRefundRepository refunds;private final PosRefundLineRepository refundLines;private final PosRefundTenderRepository refundTenders;private final WarehouseStockRepository warehouseStock;private final ItemRepository items;private final InventoryMovementRepository movements;private final QualityLotRepository qualityLots;private final TenantAuditEventRepository audit;
    public PosRefundService(CurrentTenant tenant,TenantMembershipRepository memberships,TenantMembershipBranchRepository branches,PosSaleRepository sales,PosRegisterSessionRepository sessions,PosSaleLineRepository saleLines,PosRefundRepository refunds,PosRefundLineRepository refundLines,PosRefundTenderRepository refundTenders,WarehouseStockRepository warehouseStock,ItemRepository items,InventoryMovementRepository movements,QualityLotRepository qualityLots,TenantAuditEventRepository audit){this.tenant=tenant;this.memberships=memberships;this.branches=branches;this.sales=sales;this.sessions=sessions;this.saleLines=saleLines;this.refunds=refunds;this.refundLines=refundLines;this.refundTenders=refundTenders;this.warehouseStock=warehouseStock;this.items=items;this.movements=movements;this.qualityLots=qualityLots;this.audit=audit;}

    @Transactional
    public RefundView refund(UUID actor,UUID saleId,RefundRequest request){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);String key=request.idempotencyKey().trim();String hash=payloadHash(request);PosRefundEntity prior=refunds.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);if(prior!=null){if(!prior.getSale().getId().equals(saleId)||!prior.getPayloadHash().equals(hash))throw conflict("Idempotency key was reused with different return details");checkScope(tenantId,actor,prior.getSale());return view(prior);}
        PosSaleEntity sale=sales.findForUpdate(tenantId,saleId).orElseThrow(()->notFound("POS receipt not found"));checkScope(tenantId,actor,sale);PosRegisterSessionEntity refundSession=request.sessionId()!=null?sessions.findForUpdate(tenantId,request.sessionId()).orElse(null):null;if(refundSession==null||!"OPEN".equals(refundSession.getStatus())){refundSession=sessions.findAllByTenantIdOrderByOpenedAtDesc(tenantId).stream().filter(s->"OPEN".equals(s.getStatus())&&s.getRegister().getWarehouse().getBranchId().equals(sale.getSession().getRegister().getWarehouse().getBranchId())).findFirst().orElseGet(()->sessions.saveAndFlush(new PosRegisterSessionEntity(tenantId,sale.getSession().getRegister(),actor,BigDecimal.ZERO)));}if(!refundSession.getRegister().getWarehouse().getBranchId().equals(sale.getSession().getRegister().getWarehouse().getBranchId()))throw badRequest("Refunds must be recorded at the original receipt’s store");checkSessionScope(tenantId,actor,refundSession);if("VOIDED".equals(sale.getStatus())||sale.getRefundedTotal().compareTo(sale.getTotal())>=0)throw conflict("This receipt has no refundable balance");
        Map<UUID,PosSaleLineEntity> available=saleLines.findAllByTenantIdAndSaleId(tenantId,saleId).stream().collect(Collectors.toMap(PosSaleLineEntity::getId,line->line));Map<UUID,Integer> requested=new TreeMap<>();for(var line:request.lines())requested.merge(line.saleLineId(),line.quantity(),Math::addExact);if(requested.isEmpty())throw badRequest("Select at least one receipt line to return");
        List<CalculatedLine> calculations=new ArrayList<>();BigDecimal subtotal=BigDecimal.ZERO,taxTotal=BigDecimal.ZERO;
        for(var entry:requested.entrySet()){PosSaleLineEntity line=available.get(entry.getKey());if(line==null)throw badRequest("A selected line does not belong to this receipt");int quantity=entry.getValue();if(quantity>line.getRefundableQuantity())throw conflict("Return quantity exceeds the remaining sold quantity for "+line.getSku());String disposition=request.lines().stream().filter(value->value.saleLineId().equals(entry.getKey())).map(value->value.disposition().trim().toUpperCase(Locale.ROOT)).distinct().reduce((left,right)->{throw badRequest("Each receipt line can be returned only once per request");}).orElseThrow();if(!DISPOSITIONS.contains(disposition))throw badRequest("Choose restock, quarantine, or scrap for each returned line");
            int cumulative=Math.addExact(line.getRefundedQuantity(),quantity);BigDecimal cumulativeSubtotal=line.getUnitPrice().multiply(BigDecimal.valueOf(cumulative)).setScale(2,RoundingMode.HALF_UP);BigDecimal cumulativeTax=cumulativeSubtotal.multiply(sale.getTaxRate()).movePointLeft(2).setScale(2,RoundingMode.HALF_UP);BigDecimal lineSubtotal=cumulativeSubtotal.subtract(line.getRefundedSubtotal());BigDecimal lineTax=cumulativeTax.subtract(line.getRefundedTaxTotal());calculations.add(new CalculatedLine(line,quantity,disposition,lineSubtotal,lineTax));subtotal=subtotal.add(lineSubtotal);taxTotal=taxTotal.add(lineTax);
        }
        BigDecimal total=subtotal.add(taxTotal).setScale(2,RoundingMode.HALF_UP);if(total.signum()<=0)throw badRequest("Selected returned lines do not have a refundable amount");BigDecimal tenderTotal=request.tenders().stream().map(value->money(value.amount())).reduce(BigDecimal.ZERO,BigDecimal::add);if(tenderTotal.compareTo(total)!=0)throw badRequest("Refund tender amounts must exactly equal the refund total");
        String number=refundNumber();PosRefundEntity draft=new PosRefundEntity(tenantId,sale,refundSession,key,hash,number,request.reason().trim(),subtotal,taxTotal,actor);final PosRefundEntity refund;try{refund=refunds.saveAndFlush(draft);}catch(DataIntegrityViolationException exception){throw conflict("Return already recorded; retry with its idempotency key");}
        List<PosRefundLineEntity> savedLines=new ArrayList<>();for(CalculatedLine calculated:calculations){PosSaleLineEntity line=calculated.line();ItemEntity item=items.findForUpdate(tenantId,line.getItem().getId()).orElseThrow(()->conflict("The returned product is no longer available in this workspace"));String disposition=calculated.disposition();if(item.isQualityInspectionRequired()&&"RESTOCK".equals(disposition))throw conflict("This product requires inspection; choose quarantine for the returned units");if("SERVICE".equals(item.getItemType())&&!("SCRAP".equals(disposition)))throw badRequest("Service items cannot be restocked; use scrap disposition");line.addRefund(calculated.quantity(),calculated.subtotal(),calculated.taxTotal());if(!"SCRAP".equals(disposition)){WarehouseEntity warehouse=sale.getSession().getRegister().getWarehouse();WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->conflict("The original warehouse stock balance is missing"));if("QUARANTINE".equals(disposition)){item.receiveStockForQuality(calculated.quantity());balance.receiveStock(calculated.quantity());balance.addQualityHold(calculated.quantity());qualityLots.save(new QualityLotEntity(tenantId,item,warehouse,"POS_RETURN",number+":"+line.getSku(),calculated.quantity()));}else{item.receiveStock(calculated.quantity());balance.receiveStock(calculated.quantity());}movements.save(new InventoryMovementEntity(tenantId,item,warehouse,calculated.quantity(),"POS_RETURN_"+disposition,number,"pos-return:"+refund.getId()+":"+line.getId()));}savedLines.add(new PosRefundLineEntity(tenantId,refund,line,calculated.quantity(),disposition,calculated.subtotal(),calculated.taxTotal()));}
        refundLines.saveAll(savedLines);List<PosRefundTenderEntity> savedTenders=request.tenders().stream().map(value->new PosRefundTenderEntity(tenantId,refund,value.method().trim().toUpperCase(Locale.ROOT),money(value.amount()),blankToNull(value.reference()))).toList();refundTenders.saveAll(savedTenders);sale.addRefund(total);audit.save(new TenantAuditEventEntity(tenantId,actor,"POS_SALE_REFUNDED","pos_sale",saleId,Map.of("receiptNumber",sale.getReceiptNumber(),"refundNumber",number,"amount",total,"reason",request.reason().trim())));return view(refund,savedLines,savedTenders);
    }

    @Transactional(readOnly=true)
    public List<RefundView> list(UUID actor,UUID saleId){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);PosSaleEntity sale=sales.findByTenantIdAndId(tenantId,saleId).orElseThrow(()->notFound("POS receipt not found"));checkScope(tenantId,actor,sale);return refunds.findAllByTenantIdAndSaleIdOrderByCreatedAtDesc(tenantId,saleId).stream().map(this::view).toList();}
    private RefundView view(PosRefundEntity refund){return view(refund,refundLines.findAllByTenantIdAndRefundId(refund.getTenantId(),refund.getId()),refundTenders.findAllByTenantIdAndRefundId(refund.getTenantId(),refund.getId()));}
    private RefundView view(PosRefundEntity refund,List<PosRefundLineEntity> lines,List<PosRefundTenderEntity> tenders){return new RefundView(refund.getId(),refund.getSale().getId(),refund.getSale().getReceiptNumber(),refund.getRefundNumber(),refund.getReason(),refund.getSubtotal(),refund.getTaxTotal(),refund.getTotal(),refund.getCreatedAt(),lines.stream().map(line->new RefundLineView(line.getSku(),line.getItemName(),line.getQuantity(),line.getDisposition(),line.getSubtotal(),line.getTaxTotal(),line.getTotal())).toList(),tenders.stream().map(tender->new RefundTenderView(tender.getMethod(),tender.getAmount(),tender.getReference())).toList());}
    private void checkScope(UUID tenantId,UUID actor,PosSaleEntity sale){if(!branches.findActiveBranchIds(tenantId,actor).contains(sale.getSession().getRegister().getWarehouse().getBranchId()))throw new ForbiddenException("This receipt is outside your assigned store scope");}
    private void checkSessionScope(UUID tenantId,UUID actor,PosRegisterSessionEntity session){if(!branches.findActiveBranchIds(tenantId,actor).contains(session.getRegister().getWarehouse().getBranchId()))throw new ForbiddenException("Refund register is outside your assigned store scope");}
    private void requireManager(UUID tenantId,UUID actor){String role=memberships.findActiveRole(tenantId,actor).orElse("");if(!Set.of("OWNER","ADMIN","MANAGER").contains(role))throw new ForbiddenException("A store manager must approve POS refunds");}
    private BigDecimal money(BigDecimal value){try{return value.setScale(2,RoundingMode.UNNECESSARY);}catch(ArithmeticException exception){throw badRequest("Money values must use no more than two decimal places");}}
    private String payloadHash(RefundRequest request){String canonical=request.sessionId()+"|"+request.reason().trim()+"|"+request.lines().stream().map(line->line.saleLineId()+":"+line.quantity()+":"+line.disposition().trim().toUpperCase(Locale.ROOT)).sorted().collect(Collectors.joining(","))+"|"+request.tenders().stream().map(tender->tender.method().trim().toUpperCase(Locale.ROOT)+":"+money(tender.amount()).toPlainString()+":"+Objects.toString(blankToNull(tender.reference()),"")).sorted().collect(Collectors.joining(","));try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException exception){throw new IllegalStateException("Unable to fingerprint POS refund",exception);}}
    private String refundNumber(){return "PCR-"+DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("UTC")).format(Instant.now())+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);}
    private String blankToNull(String value){return value==null||value.isBlank()?null:value.trim();}
    private ResponseStatusException badRequest(String message){return new BadRequestException(message);}private ResponseStatusException conflict(String message){return new ConflictException(message);}private ResponseStatusException notFound(String message){return new NotFoundException(message);}
    private record CalculatedLine(PosSaleLineEntity line,int quantity,String disposition,BigDecimal subtotal,BigDecimal taxTotal){}
}
