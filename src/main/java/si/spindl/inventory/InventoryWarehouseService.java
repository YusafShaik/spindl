package si.spindl.inventory;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.CurrentTenant;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantBranchRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import si.spindl.inventory.InventoryWarehouseDtos.CreateWarehouseRequest;
import si.spindl.inventory.InventoryWarehouseDtos.TransferRequest;
import si.spindl.inventory.InventoryWarehouseDtos.WarehouseView;
import si.spindl.inventory.InventoryWarehouseDtos.WarehouseStockView;
import si.spindl.inventory.InventoryWarehouseDtos.TransferView;

@Service
public class InventoryWarehouseService {
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository stock;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final InventoryTransferRepository transfers;
    private final CurrentTenant tenant;
    private final TenantAuditEventRepository audit;
    private final TenantBranchRepository branches;

    public InventoryWarehouseService(WarehouseRepository warehouses,WarehouseStockRepository stock,ItemRepository items,InventoryMovementRepository movements,InventoryTransferRepository transfers,CurrentTenant tenant,TenantAuditEventRepository audit,TenantBranchRepository branches){this.warehouses=warehouses;this.stock=stock;this.items=items;this.movements=movements;this.transfers=transfers;this.tenant=tenant;this.audit=audit;this.branches=branches;}

    @Transactional(readOnly=true)
    public List<WarehouseView> list(){return warehouses.findAllByTenantIdAndActiveTrueOrderByIsDefaultDescNameAsc(tenant.currentTenantId()).stream().map(InventoryWarehouseMapper::toWarehouseView).toList();}

    @Transactional
    public WarehouseView create(CreateWarehouseRequest request){
        UUID tenantId=tenant.currentTenantId();String code=request.code().trim().toUpperCase(Locale.ROOT);String name=request.name().trim();
        if(warehouses.existsByTenantIdAndCodeIgnoreCase(tenantId,code))throw new ConflictException("Warehouse code already exists");
        UUID branchId=request.branchId()==null?branches.findFirstByTenantIdAndDefaultBranchTrue(tenantId).map(si.spindl.identity.TenantBranchEntity::getId).orElseThrow():branches.findByTenantIdAndId(tenantId,request.branchId()).filter(si.spindl.identity.TenantBranchEntity::isActive).map(si.spindl.identity.TenantBranchEntity::getId).orElseThrow(()->new BadRequestException("Choose an active workspace branch"));
        try{WarehouseEntity warehouse=warehouses.saveAndFlush(new WarehouseEntity(tenantId,code,name,branchId));stock.saveAll(items.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream().map(item->new WarehouseStockEntity(tenantId,warehouse,item)).toList());return InventoryWarehouseMapper.toWarehouseView(warehouse);}
        catch(DataIntegrityViolationException exception){throw new ConflictException("Warehouse code already exists");}
    }

    @Transactional(readOnly=true)
    public List<WarehouseStockView> balances(UUID warehouseId){
        WarehouseEntity warehouse=warehouse(warehouseId);
        return stock.findBalances(tenant.currentTenantId(),warehouse.getId()).stream().map(balance->{int reserved=balance.getReservedQuantity()+balance.getManufacturingReservedQuantity();int available=balance.getOnHand()-balance.getQualityHoldQuantity()-reserved;return new WarehouseStockView(balance.getItem().getId(),balance.getItem().getSku(),balance.getItem().getName(),balance.getItem().getUnit(),balance.getOnHand(),reserved,balance.getQualityHoldQuantity(),available);}).toList();
    }

    @Transactional
    public List<TransferView> transfers(){return transfers.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId()).stream().map(InventoryWarehouseMapper::toTransferView).toList();}

    @Transactional
    public TransferView transfer(TransferRequest request,UUID actorId){
        UUID tenantId=tenant.currentTenantId();String reason=request.reason().trim();
        InventoryTransferEntity existing=transfers.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),request.sourceWarehouseId(),request.destinationWarehouseId(),request.quantity(),reason))throw conflict("Idempotency key was reused with different transfer details");return InventoryWarehouseMapper.toTransferView(existing);}
        if(request.sourceWarehouseId().equals(request.destinationWarehouseId()))throw badRequest("Choose two different warehouses");
        WarehouseEntity source=warehouse(request.sourceWarehouseId());WarehouseEntity destination=warehouse(request.destinationWarehouseId());
        ItemEntity item=items.findActiveForUpdate(tenantId,request.itemId()).orElseThrow(()->new NotFoundException("Active item not found"));
        existing=transfers.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(existing!=null){if(!existing.matches(request.itemId(),source.getId(),destination.getId(),request.quantity(),reason))throw conflict("Idempotency key was reused with different transfer details");return InventoryWarehouseMapper.toTransferView(existing);}
        WarehouseStockEntity sourceBalance=stock.findForUpdate(tenantId,source.getId(),item.getId()).orElseThrow(()->conflict("No stock balance exists at the source warehouse"));
        stock.findForUpdate(tenantId,destination.getId(),item.getId()).orElseThrow(()->conflict("Destination stock balance is missing"));
        try{sourceBalance.reserve(request.quantity());}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Transfer exceeds stock available at the source warehouse");}
        InventoryTransferEntity transfer=new InventoryTransferEntity(tenantId,item,source,destination,request.quantity(),reason,request.idempotencyKey());
        try{var saved=transfers.saveAndFlush(transfer);audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_TRANSFER_CREATED","inventory_transfer",saved.getId(),java.util.Map.of("sku",item.getSku(),"quantity",request.quantity(),"source",source.getCode(),"destination",destination.getCode())));return InventoryWarehouseMapper.toTransferView(saved);}
        catch(DataIntegrityViolationException exception){throw conflict("Transfer already exists; retry with its idempotency key");}
    }

    @Transactional
    public TransferView approve(UUID id,UUID actorId){UUID tenantId=tenant.currentTenantId();var transfer=lockTransfer(tenantId,id);if(transfer.getStatus().equals("APPROVED"))return InventoryWarehouseMapper.toTransferView(transfer);if(!transfer.getStatus().equals("DRAFT"))throw conflict("Only draft transfers can be approved");transfer.approve(actorId);audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_TRANSFER_APPROVED","inventory_transfer",id,java.util.Map.of("quantity",transfer.getQuantity())));return InventoryWarehouseMapper.toTransferView(transfer);}

    @Transactional
    public TransferView dispatch(UUID id,UUID actorId){UUID tenantId=tenant.currentTenantId();var transfer=lockTransfer(tenantId,id);if(transfer.getStatus().equals("IN_TRANSIT")||transfer.getStatus().equals("RECEIVED"))return InventoryWarehouseMapper.toTransferView(transfer);if(!transfer.getStatus().equals("APPROVED"))throw conflict("Approve the transfer before dispatch");var item=items.findForUpdate(tenantId,transfer.getItem().getId()).orElseThrow(()->conflict("Transfer item no longer exists"));var source=stock.findForUpdate(tenantId,transfer.getSourceWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Source stock balance is missing"));try{source.dispatchReservedStock(transfer.getQuantity());if(transfer.getSourceWarehouse().isDefault())item.adjustStock(-transfer.getQuantity());else item.adjustStockInExternalWarehouse(-transfer.getQuantity());}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Could not dispatch transfer: "+exception.getMessage());}String reference=transferReference(transfer);movements.save(new InventoryMovementEntity(tenantId,item,transfer.getSourceWarehouse(),-transfer.getQuantity(),"Warehouse transfer out: "+transfer.getReason(),reference,movementKey(transfer,"OUT")));transfer.dispatch();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_TRANSFER_DISPATCHED","inventory_transfer",id,java.util.Map.of("quantity",transfer.getQuantity(),"source",transfer.getSourceWarehouse().getCode())));return InventoryWarehouseMapper.toTransferView(transfer);}

    @Transactional
    public TransferView receive(UUID id,UUID actorId){UUID tenantId=tenant.currentTenantId();var transfer=lockTransfer(tenantId,id);if(transfer.getStatus().equals("RECEIVED"))return InventoryWarehouseMapper.toTransferView(transfer);if(!transfer.getStatus().equals("IN_TRANSIT"))throw conflict("Only in-transit transfers can be received");var item=items.findForUpdate(tenantId,transfer.getItem().getId()).orElseThrow(()->conflict("Transfer item no longer exists"));var destination=stock.findForUpdate(tenantId,transfer.getDestinationWarehouse().getId(),item.getId()).orElseThrow(()->conflict("Destination stock balance is missing"));try{destination.receiveStock(transfer.getQuantity());if(transfer.getDestinationWarehouse().isDefault())item.adjustStock(transfer.getQuantity());else item.adjustStockInExternalWarehouse(transfer.getQuantity());}catch(IllegalArgumentException|ArithmeticException exception){throw conflict("Could not receive transfer: "+exception.getMessage());}movements.save(new InventoryMovementEntity(tenantId,item,transfer.getDestinationWarehouse(),transfer.getQuantity(),"Warehouse transfer in: "+transfer.getReason(),transferReference(transfer),movementKey(transfer,"IN")));transfer.receive();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_TRANSFER_RECEIVED","inventory_transfer",id,java.util.Map.of("quantity",transfer.getQuantity(),"destination",transfer.getDestinationWarehouse().getCode())));return InventoryWarehouseMapper.toTransferView(transfer);}

    @Transactional
    public TransferView cancel(UUID id,UUID actorId){UUID tenantId=tenant.currentTenantId();var transfer=lockTransfer(tenantId,id);if(transfer.getStatus().equals("CANCELLED"))return InventoryWarehouseMapper.toTransferView(transfer);if(!List.of("DRAFT","APPROVED").contains(transfer.getStatus()))throw conflict("A dispatched transfer cannot be cancelled");var balance=stock.findForUpdate(tenantId,transfer.getSourceWarehouse().getId(),transfer.getItem().getId()).orElseThrow(()->conflict("Source stock balance is missing"));balance.releaseReservation(transfer.getQuantity());transfer.cancel();audit.save(new TenantAuditEventEntity(tenantId,actorId,"INVENTORY_TRANSFER_CANCELLED","inventory_transfer",id,java.util.Map.of()));return InventoryWarehouseMapper.toTransferView(transfer);}

    private InventoryTransferEntity lockTransfer(UUID tenantId,UUID id){return transfers.findForUpdate(tenantId,id).orElseThrow(()->new NotFoundException("Transfer not found"));}
    private String transferReference(InventoryTransferEntity transfer){return "TRF-"+UUID.nameUUIDFromBytes(transfer.getIdempotencyKey().getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString().substring(0,12).toUpperCase(Locale.ROOT);}
    private String movementKey(InventoryTransferEntity transfer,String leg){return "TR-"+UUID.nameUUIDFromBytes((transfer.getIdempotencyKey()+":"+leg).getBytes(java.nio.charset.StandardCharsets.UTF_8));}

    private WarehouseEntity warehouse(UUID id){return warehouses.findByTenantIdAndIdAndActiveTrue(tenant.currentTenantId(),id).orElseThrow(()->new NotFoundException("Active warehouse not found"));}
    private ResponseStatusException conflict(String message){return new ConflictException(message);}
    private ResponseStatusException badRequest(String message){return new BadRequestException(message);}

}
