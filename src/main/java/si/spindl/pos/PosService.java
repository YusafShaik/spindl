package si.spindl.pos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Digits;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.finance.TenantFinanceSettingsEntity;
import si.spindl.finance.TenantFinanceSettingsRepository;
import si.spindl.identity.*;
import si.spindl.party.CustomerRepository;
import si.spindl.quality.QualityLotEntity;
import si.spindl.quality.QualityLotRepository;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PosService {
    private final DevelopmentTenant tenant;
    private final PosRegisterRepository registers;
    private final PosRegisterSessionRepository sessions;
    private final PosSaleRepository sales;
    private final PosSaleLineRepository saleLines;
    private final PosSaleTenderRepository tenders;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final CustomerRepository customers;
    private final TenantMembershipRepository memberships;
    private final TenantMembershipBranchRepository memberBranches;
    private final TenantFinanceSettingsRepository financeSettings;
    private final TenantAuditEventRepository audit;
    private final QualityLotRepository qualityLots;

    private final TeamService team;
    public PosService(DevelopmentTenant tenant,PosRegisterRepository registers,PosRegisterSessionRepository sessions,PosSaleRepository sales,PosSaleLineRepository saleLines,PosSaleTenderRepository tenders,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock,ItemRepository items,InventoryMovementRepository movements,CustomerRepository customers,TenantMembershipRepository memberships,TenantMembershipBranchRepository memberBranches,TenantFinanceSettingsRepository financeSettings,TenantAuditEventRepository audit,QualityLotRepository qualityLots,TeamService team){this.tenant=tenant;this.registers=registers;this.sessions=sessions;this.sales=sales;this.saleLines=saleLines;this.tenders=tenders;this.warehouses=warehouses;this.warehouseStock=warehouseStock;this.items=items;this.movements=movements;this.customers=customers;this.memberships=memberships;this.memberBranches=memberBranches;this.financeSettings=financeSettings;this.audit=audit;this.qualityLots=qualityLots;this.team=team;}

    @Transactional(readOnly=true)
    public List<RegisterView> registers(UUID actor){UUID tenantId=tenant.currentTenantId();Set<UUID> branchIds=branchScope(tenantId,actor);boolean manager=isManager(tenantId,actor);return registers.findAllByTenantIdAndActiveTrueOrderByNameAsc(tenantId).stream().filter(register->branchIds.contains(register.getWarehouse().getBranchId())).filter(register->manager||actor.equals(register.getAssignedCashierUserId())).map(RegisterView::from).toList();}

    @Transactional(readOnly=true)
    public List<CashierView> cashiers(UUID actor,UUID warehouseId){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);WarehouseEntity warehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,warehouseId).orElseThrow(()->badRequest("Choose an active shop warehouse"));if(!branchScope(tenantId,actor).contains(warehouse.getBranchId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Warehouse is outside your assigned store scope");return team.listMembers(tenantId).stream().filter(si.spindl.identity.TeamDtos.MembershipView::active).filter(member->!"VIEWER".equals(member.role())).filter(member->member.branchIds().contains(warehouse.getBranchId())).map(member->new CashierView(UUID.fromString(member.userId()),member.name(),member.email(),member.role())).toList();}

    @Transactional(readOnly=true)
    public PosSettingsView settings(){var settings=financeSettings.findById(tenant.currentTenantId()).orElse(null);return new PosSettingsView(settings==null?"NONE":settings.getTaxCode(),settings==null?BigDecimal.ZERO:settings.getTaxRate());}

    @Transactional
    public RegisterView createRegister(UUID actor,CreateRegisterRequest request){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);WarehouseEntity warehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,request.warehouseId()).orElseThrow(()->badRequest("Choose an active shop warehouse"));if(!branchScope(tenantId,actor).contains(warehouse.getBranchId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Choose a warehouse in your assigned store scope");ensureCashierInBranch(tenantId,request.cashierUserId(),warehouse.getBranchId());String code=request.code().trim().toUpperCase(Locale.ROOT);if(registers.existsByTenantIdAndCodeIgnoreCase(tenantId,code))throw conflict("Register code already exists");try{return RegisterView.from(registers.saveAndFlush(new PosRegisterEntity(tenantId,warehouse,code,request.name().trim(),request.cashierUserId())));}catch(DataIntegrityViolationException exception){throw conflict("Register code already exists");}}

    @Transactional
    public RegisterView assignCashier(UUID actor,UUID registerId,AssignCashierRequest request){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);PosRegisterEntity register=registers.findByTenantIdAndIdAndActiveTrue(tenantId,registerId).orElseThrow(()->notFound("Active register not found"));requireRegisterBranch(tenantId,actor,register);ensureCashierInBranch(tenantId,request.cashierUserId(),register.getWarehouse().getBranchId());register.assignCashier(request.cashierUserId());return RegisterView.from(register);}

    @Transactional(readOnly=true)
    public List<SessionView> sessions(UUID actor){UUID tenantId=tenant.currentTenantId();Set<UUID> branchIds=branchScope(tenantId,actor);boolean manager=isManager(tenantId,actor);return sessions.findAllByTenantIdOrderByOpenedAtDesc(tenantId).stream().filter(session->branchIds.contains(session.getRegister().getWarehouse().getBranchId())).filter(session->manager||actor.equals(session.getCashierUserId())).limit(100).map(SessionView::from).toList();}

    @Transactional
    public SessionView open(UUID actor,OpenSessionRequest request){
        UUID tenantId=tenant.currentTenantId();
        PosRegisterEntity register=registers.findByTenantIdAndIdAndActiveTrue(tenantId,request.registerId()).orElseThrow(()->notFound("Active register not found"));
        requireRegisterBranch(tenantId,actor,register);
        var existing = sessions.findAllByTenantIdOrderByOpenedAtDesc(tenantId).stream()
                .filter(s -> "OPEN".equals(s.getStatus()) && s.getRegister().getId().equals(register.getId()))
                .findFirst().orElse(null);
        if (existing != null) return SessionView.from(existing);
        return SessionView.from(sessions.saveAndFlush(new PosRegisterSessionEntity(tenantId,register,actor,request.openingFloat() == null ? BigDecimal.ZERO : request.openingFloat())));
    }

    @Transactional
    public SessionView close(UUID actor,UUID sessionId,CloseSessionRequest request){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);PosRegisterSessionEntity session=sessions.findForUpdate(tenantId,sessionId).orElseThrow(()->notFound("Register session not found"));requireRegisterBranch(tenantId,actor,session.getRegister());if(!"OPEN".equals(session.getStatus()))return SessionView.from(session);BigDecimal expected=session.getOpeningFloat().add(sales.cashTenderedForSession(tenantId,sessionId)).subtract(sales.cashRefundedForSession(tenantId,sessionId));session.close(expected,money(request.countedCash()));audit.save(new TenantAuditEventEntity(tenantId,actor,"POS_REGISTER_SESSION_CLOSED","pos_session",sessionId,Map.of("registerCode",session.getRegister().getCode(),"expectedCash",expected,"countedCash",session.getCountedCash(),"variance",session.getCashVariance())));return SessionView.from(session);}

    @Transactional
    public SaleView checkout(UUID actor,UUID sessionId,CheckoutRequest request){UUID tenantId=tenant.currentTenantId();String key=request.idempotencyKey().trim();String hash=payloadHash(sessionId,request);PosSaleEntity previous=sales.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);if(previous!=null){requireRegisterBranch(tenantId,actor,previous.getSession().getRegister());return replay(previous,hash);}
        PosRegisterSessionEntity session=sessions.findForUpdate(tenantId,sessionId).orElse(null);
        if(session==null||!"OPEN".equals(session.getStatus())){
            session=sessions.findAllByTenantIdOrderByOpenedAtDesc(tenantId).stream()
                    .filter(s->"OPEN".equals(s.getStatus()))
                    .findFirst()
                    .orElseGet(()->{
                        PosRegisterEntity reg=registers.findAllByTenantIdAndActiveTrueOrderByNameAsc(tenantId).stream().findFirst()
                                .orElseThrow(()->notFound("No active register found in this workspace"));
                        return sessions.saveAndFlush(new PosRegisterSessionEntity(tenantId,reg,actor,BigDecimal.ZERO));
                    });
        }
        requireRegisterBranch(tenantId,actor,session.getRegister());
        previous=sales.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);if(previous!=null)return replay(previous,hash);
        si.spindl.party.CustomerEntity customer=null; if(request.customerId()!=null){var found=customers.findByTenantIdAndId(tenantId,request.customerId()).orElseThrow(()->badRequest("Customer not found in this workspace"));if(!found.isActive())throw badRequest("Choose an active customer");customer=found;}
        Map<UUID,Integer> quantities=new TreeMap<>();for(var line:request.lines())quantities.merge(line.itemId(),line.quantity(),Math::addExact);
        List<LockedLine> locked=new ArrayList<>();BigDecimal subtotal=BigDecimal.ZERO;
        for(var entry:quantities.entrySet()){
            List<CheckoutLineRequest> priceRequests=request.lines().stream().filter(line->line.itemId().equals(entry.getKey())).toList();if(priceRequests.size()!=1)throw badRequest("Add each product once, then change its quantity");CheckoutLineRequest priceRequest=priceRequests.get(0);BigDecimal override=priceRequest.unitPriceOverride();BigDecimal discount=priceRequest.discountPercent()==null?BigDecimal.ZERO:priceRequest.discountPercent();if(discount.signum()>0||override!=null){String role=memberships.findActiveRole(tenantId,actor).orElse("");if(!Set.of("OWNER","ADMIN","MANAGER").contains(role))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only a store manager can apply a discount or override price");}if(discount.signum()<0||discount.compareTo(new BigDecimal("99.99"))>0)throw badRequest("Discount must be between 0 and 99.99 percent");
            ItemEntity item=items.findActiveForUpdate(tenantId,entry.getKey()).orElseThrow(()->badRequest("One of the selected products is inactive or unavailable"));if(!Set.of("FINISHED","SERVICE").contains(item.getItemType()))throw badRequest("Only finished goods and service items can be sold at POS");int quantity=entry.getValue();BigDecimal listPrice=override==null?item.getUnitPrice():money(override);BigDecimal unitPrice=listPrice.multiply(BigDecimal.ONE.subtract(discount.movePointLeft(2))).setScale(2,RoundingMode.HALF_UP);BigDecimal lineSubtotal=unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2,RoundingMode.HALF_UP);subtotal=subtotal.add(lineSubtotal);locked.add(new LockedLine(item,quantity,listPrice,discount,unitPrice,lineSubtotal));
        }
        TenantFinanceSettingsEntity settings=financeSettings.findForUpdate(tenantId).orElse(null);String taxCode=settings==null?"NONE":settings.getTaxCode();BigDecimal taxRate=settings==null?BigDecimal.ZERO:settings.getTaxRate();BigDecimal taxTotal=locked.stream().map(line->taxFor(line.subtotal(),taxRate)).reduce(BigDecimal.ZERO,BigDecimal::add);BigDecimal total=subtotal.add(taxTotal).setScale(2,RoundingMode.HALF_UP);
        BigDecimal tendered=request.tenders().stream().map(tender->money(tender.amount())).reduce(BigDecimal.ZERO,BigDecimal::add);if(tendered.compareTo(total)!=0)throw badRequest("Tender amounts must exactly equal the amount due");
        for(LockedLine line:locked)if(!"SERVICE".equals(line.item().getItemType())){WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,session.getRegister().getWarehouse().getId(),line.item().getId()).orElseThrow(()->conflict("Product stock is not initialized at this register's warehouse"));try{balance.sellAvailable(line.quantity());line.item().adjustStock(-line.quantity());}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Insufficient available stock for "+line.item().getSku());}}
        String receipt=receiptNumber();PosSaleEntity draft=new PosSaleEntity(tenantId,session,key,hash,receipt,customer==null?null:customer.getId(),subtotal,taxCode,taxRate,taxTotal);final PosSaleEntity sale;try{sale=sales.saveAndFlush(draft);}catch(DataIntegrityViolationException exception){throw conflict("Sale already posted; reload the receipt using its idempotency key");}
        List<PosSaleLineEntity> lineEntities=new ArrayList<>();for(LockedLine line:locked){BigDecimal lineTax=taxFor(line.subtotal(),taxRate);lineEntities.add(new PosSaleLineEntity(tenantId,sale,line.item(),line.quantity(),line.listPrice(),line.discountPercent(),line.unitPrice(),line.subtotal(),lineTax));if(!"SERVICE".equals(line.item().getItemType()))movements.save(new InventoryMovementEntity(tenantId,line.item(),session.getRegister().getWarehouse(),-line.quantity(),"POS_SALE",receipt,"pos:"+sale.getId()+":"+line.item().getId()));}saleLines.saveAll(lineEntities);
        List<PosSaleTenderEntity> tenderEntities=request.tenders().stream().map(value->new PosSaleTenderEntity(tenantId,sale,value.method().trim().toUpperCase(Locale.ROOT),money(value.amount()),blankToNull(value.reference()))).toList();tenders.saveAll(tenderEntities);
        audit.save(new TenantAuditEventEntity(tenantId,actor,"POS_SALE_POSTED","pos_sale",sale.getId(),Map.of("receiptNumber",receipt,"total",total,"registerCode",session.getRegister().getCode(),"lineCount",lineEntities.size())));return view(sale,lineEntities,tenderEntities);
    }

    @Transactional
    public SaleView voidSale(UUID actor,UUID saleId,VoidSaleRequest request){UUID tenantId=tenant.currentTenantId();requireManager(tenantId,actor);String key=request.idempotencyKey().trim();String reason=request.reason().trim();String hash=voidHash(saleId,reason);PosSaleEntity sale=sales.findForUpdate(tenantId,saleId).orElseThrow(()->notFound("POS receipt not found"));requireRegisterBranch(tenantId,actor,sale.getSession().getRegister());if("VOIDED".equals(sale.getStatus())){if(!hash.equals(sale.getVoidPayloadHash()))throw conflict("This receipt was already voided with different details");return view(sale);}if(!"POSTED".equals(sale.getStatus())||sale.getRefundedTotal().signum()>0)throw conflict("Only an unrefunded posted receipt can be voided");PosRegisterSessionEntity session=sessions.findForUpdate(tenantId,sale.getSession().getId()).orElse(sale.getSession());List<PosSaleTenderEntity> saleTenders=tenders.findAllByTenantIdAndSaleId(tenantId,saleId);if(saleTenders.isEmpty()||saleTenders.stream().anyMatch(tender->!"CASH".equals(tender.getMethod())))throw conflict("Only cash receipts can be voided here. For card or UPI, process the payment reversal at the terminal and record a receipt refund.");WarehouseEntity warehouse=session.getRegister().getWarehouse();List<PosSaleLineEntity> lines=saleLines.findAllByTenantIdAndSaleId(tenantId,saleId);for(PosSaleLineEntity line:lines){ItemEntity item=items.findForUpdate(tenantId,line.getItem().getId()).orElseThrow(()->conflict("A receipt item is no longer available"));if(!"SERVICE".equals(item.getItemType())){WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,warehouse.getId(),item.getId()).orElseThrow(()->conflict("The original warehouse stock balance is missing"));if(item.isQualityInspectionRequired()){item.receiveStockForQuality(line.getQuantity());balance.receiveStock(line.getQuantity());balance.addQualityHold(line.getQuantity());qualityLots.save(new QualityLotEntity(tenantId,item,warehouse,"POS_VOID",sale.getReceiptNumber()+":"+line.getSku(),line.getQuantity()));}else{item.receiveStock(line.getQuantity());balance.receiveStock(line.getQuantity());}movements.save(new InventoryMovementEntity(tenantId,item,warehouse,line.getQuantity(),item.isQualityInspectionRequired()?"POS_VOID_QUARANTINE":"POS_VOID",sale.getReceiptNumber(),"pos-void:"+saleId+":"+line.getId()));}}sale.voidSale(key,hash,reason,actor);try{sales.flush();}catch(DataIntegrityViolationException exception){throw conflict("Void idempotency key was already used");}audit.save(new TenantAuditEventEntity(tenantId,actor,"POS_SALE_VOIDED","pos_sale",saleId,Map.of("receiptNumber",sale.getReceiptNumber(),"reason",reason,"cashReturned",sale.getTotal())));return view(sale);}

    @Transactional(readOnly=true)
    public List<SaleView> sales(UUID actor,UUID sessionId){UUID tenantId=tenant.currentTenantId();PosRegisterSessionEntity session=sessions.findByTenantIdAndId(tenantId,sessionId).orElseThrow(()->notFound("Register session not found"));requireRegisterBranch(tenantId,actor,session.getRegister());return sales.findAllByTenantIdAndSessionIdOrderByPostedAtDesc(tenantId,sessionId).stream().map(this::view).toList();}

    @Transactional(readOnly=true)
    public List<SaleView> allSales(UUID actor){UUID tenantId=tenant.currentTenantId();return sales.findAllByTenantIdOrderByPostedAtDesc(tenantId).stream().map(this::view).toList();}

    private SaleView replay(PosSaleEntity sale,String hash){if(!sale.getPayloadHash().equals(hash))throw conflict("Idempotency key was reused with different checkout details");return view(sale);}
    private SaleView view(PosSaleEntity sale){return view(sale,saleLines.findAllByTenantIdAndSaleId(sale.getTenantId(),sale.getId()),tenders.findAllByTenantIdAndSaleId(sale.getTenantId(),sale.getId()));}
    private SaleView view(PosSaleEntity sale,List<PosSaleLineEntity> lines,List<PosSaleTenderEntity> tenders){return new SaleView(sale.getId(),sale.getSession().getId(),sale.getReceiptNumber(),sale.getStatus(),sale.getCustomerId(),sale.getSubtotal(),sale.getTaxCode(),sale.getTaxRate(),sale.getTaxTotal(),sale.getTotal(),sale.getRefundedTotal(),sale.getPostedAt(),lines.stream().map(line->new SaleLineView(line.getId(),line.getSku(),line.getItemName(),line.getQuantity(),line.getRefundedQuantity(),line.getRefundableQuantity(),line.getRefundedSubtotal(),line.getRefundedTaxTotal(),line.getListUnitPrice(),line.getDiscountPercent(),line.getUnitPrice(),line.getSubtotal(),line.getTaxTotal(),line.getTotal())).toList(),tenders.stream().map(tender->new TenderView(tender.getMethod(),tender.getAmount(),tender.getReference())).toList());}
    private PosRegisterEntity registerForActor(UUID tenantId,UUID actor,UUID registerId){PosRegisterEntity register=registers.findByTenantIdAndIdAndActiveTrue(tenantId,registerId).orElseThrow(()->notFound("Active register not found"));requireRegisterBranch(tenantId,actor,register);if(!actor.equals(register.getAssignedCashierUserId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This register is assigned to another cashier");return register;}
    private void requireRegisterBranch(UUID tenantId,UUID actor,PosRegisterEntity register){if(!branchScope(tenantId,actor).contains(register.getWarehouse().getBranchId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This register is outside your assigned store scope");}
    private Set<UUID> branchScope(UUID tenantId,UUID actor){return new HashSet<>(memberBranches.findActiveBranchIds(tenantId,actor));}
    private void requireManager(UUID tenantId,UUID actor){String role=memberships.findActiveRole(tenantId,actor).orElse("");if(!Set.of("OWNER","ADMIN","MANAGER").contains(role))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"A store manager must perform this action");}
    private boolean isManager(UUID tenantId,UUID actor){return memberships.findActiveRole(tenantId,actor).filter(role->Set.of("OWNER","ADMIN","MANAGER").contains(role)).isPresent();}
    private void ensureCashierInBranch(UUID tenantId,UUID cashierId,UUID branchId){boolean assigned=team.listMembers(tenantId).stream().anyMatch(member->member.active()&&UUID.fromString(member.userId()).equals(cashierId)&&!"VIEWER".equals(member.role())&&member.branchIds().contains(branchId));if(!assigned)throw badRequest("Choose an active cashier assigned to the register's store");}
    private BigDecimal money(BigDecimal amount){return amount.setScale(2,RoundingMode.UNNECESSARY);}
    private BigDecimal taxFor(BigDecimal amount,BigDecimal rate){return amount.multiply(rate).movePointLeft(2).setScale(2,RoundingMode.HALF_UP);}
    private String voidHash(UUID saleId,String reason){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((saleId+"|"+reason).getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException exception){throw new IllegalStateException("Unable to fingerprint POS void",exception);}}
    private String payloadHash(UUID sessionId,CheckoutRequest request){String canonical=sessionId+"|"+request.customerId()+"|"+request.lines().stream().map(line->line.itemId()+":"+line.quantity()+":"+line.unitPriceOverride()+":"+line.discountPercent()).sorted().collect(Collectors.joining(","))+"|"+request.tenders().stream().map(tender->tender.method().trim().toUpperCase(Locale.ROOT)+":"+money(tender.amount()).toPlainString()+":"+Objects.toString(blankToNull(tender.reference()),"")).sorted().collect(Collectors.joining(","));try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException exception){throw new IllegalStateException("Unable to fingerprint POS request",exception);}}
    private String receiptNumber(){return "POS-"+DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("UTC")).format(Instant.now())+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);}
    private String blankToNull(String value){return value==null||value.isBlank()?null:value.trim();}
    private ResponseStatusException badRequest(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);} private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);} private ResponseStatusException notFound(String message){return new ResponseStatusException(HttpStatus.NOT_FOUND,message);}

    private record LockedLine(ItemEntity item,int quantity,BigDecimal listPrice,BigDecimal discountPercent,BigDecimal unitPrice,BigDecimal subtotal){}
    public record CreateRegisterRequest(@NotNull UUID warehouseId,@NotNull UUID cashierUserId,@NotBlank @Size(max=32) String code,@NotBlank @Size(max=120) String name){}
    public record AssignCashierRequest(@NotNull UUID cashierUserId){}
    public record OpenSessionRequest(@NotNull UUID registerId,@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal openingFloat){}
    public record CloseSessionRequest(@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal countedCash){}
    public record CheckoutLineRequest(@NotNull UUID itemId,@Positive int quantity,@jakarta.validation.constraints.DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal unitPriceOverride,@jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.DecimalMax("99.99") @Digits(integer=3,fraction=2) BigDecimal discountPercent){}
    public record TenderRequest(@NotBlank @Pattern(regexp="(?i)CASH|CARD|UPI|OTHER") String method,@NotNull @DecimalMin(value="0.01") @Digits(integer=12,fraction=2) BigDecimal amount,@Size(max=120) String reference){}
    public record VoidSaleRequest(@NotBlank @Size(max=120) String idempotencyKey,@NotBlank @Size(max=300) String reason){}
    public record CheckoutRequest(@NotBlank @Size(max=120) String idempotencyKey,UUID customerId,@NotEmpty List<@Valid CheckoutLineRequest> lines,@NotEmpty List<@Valid TenderRequest> tenders){}
    public record CashierView(UUID userId,String name,String email,String role){}
    public record RegisterView(UUID id,String code,String name,UUID warehouseId,String warehouseCode,String warehouseName,UUID branchId,UUID assignedCashierUserId){static RegisterView from(PosRegisterEntity entity){return new RegisterView(entity.getId(),entity.getCode(),entity.getName(),entity.getWarehouse().getId(),entity.getWarehouse().getCode(),entity.getWarehouse().getName(),entity.getWarehouse().getBranchId(),entity.getAssignedCashierUserId());}}
    public record SessionView(UUID id,String status,BigDecimal openingFloat,BigDecimal expectedCash,BigDecimal countedCash,BigDecimal cashVariance,Instant openedAt,Instant closedAt,UUID cashierUserId,UUID registerId,String registerCode,String registerName,UUID branchId,String warehouseName){static SessionView from(PosRegisterSessionEntity entity){return new SessionView(entity.getId(),entity.getStatus(),entity.getOpeningFloat(),entity.getExpectedCash(),entity.getCountedCash(),entity.getCashVariance(),entity.getOpenedAt(),entity.getClosedAt(),entity.getCashierUserId(),entity.getRegister().getId(),entity.getRegister().getCode(),entity.getRegister().getName(),entity.getRegister().getWarehouse().getBranchId(),entity.getRegister().getWarehouse().getName());}}
    public record SaleLineView(UUID saleLineId,String sku,String itemName,int quantity,int refundedQuantity,int refundableQuantity,BigDecimal refundedSubtotal,BigDecimal refundedTaxTotal,BigDecimal listUnitPrice,BigDecimal discountPercent,BigDecimal unitPrice,BigDecimal subtotal,BigDecimal taxTotal,BigDecimal total){}
    public record TenderView(String method,BigDecimal amount,String reference){}
    public record PosSettingsView(String taxCode,BigDecimal taxRate){}
    public record SaleView(UUID id,UUID sessionId,String receiptNumber,String status,UUID customerId,BigDecimal subtotal,String taxCode,BigDecimal taxRate,BigDecimal taxTotal,BigDecimal total,BigDecimal refundedTotal,Instant postedAt,List<SaleLineView> lines,List<TenderView> tenders){}
}
