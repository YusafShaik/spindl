package si.spindl.sales;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.inventory.WarehouseEntity;
import si.spindl.inventory.WarehouseRepository;
import si.spindl.inventory.WarehouseStockEntity;
import si.spindl.inventory.WarehouseStockRepository;
import si.spindl.party.CustomerEntity;
import si.spindl.party.CustomerRepository;
import si.spindl.finance.InvoiceRepository;
import si.spindl.sales.SalesDtos.*;
import si.spindl.tenant.CurrentTenant;

import java.time.Year;
import java.util.*;

@Service
public class SalesService {
    private final SalesQuoteRepository quotes;
    private final SalesOrderRepository orders;
    private final SalesShipmentRepository shipments;
    private final CustomerRepository customers;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    private final CurrentTenant tenant;
    private final InvoiceRepository invoices;

    public SalesService(SalesQuoteRepository quotes,SalesOrderRepository orders,SalesShipmentRepository shipments,
                        CustomerRepository customers,ItemRepository items,InventoryMovementRepository movements,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock,CurrentTenant tenant,InvoiceRepository invoices){
        this.quotes=quotes;this.orders=orders;this.shipments=shipments;this.customers=customers;this.items=items;this.movements=movements;this.warehouses=warehouses;this.warehouseStock=warehouseStock;this.tenant=tenant;this.invoices=invoices;
    }

    @Transactional(readOnly=true)
    public List<QuoteView> listQuotes(){return quotes.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId()).stream().map(QuoteView::from).toList();}

    @Transactional
    public QuoteView createQuote(CreateQuoteRequest request){
        UUID tenantId=tenant.currentTenantId();
        if(request.lines().stream().map(QuoteLineRequest::itemId).distinct().count()!=request.lines().size())throw new BadRequestException("Each item can appear only once per quotation");
        CustomerEntity customer=customers.findByTenantIdAndId(tenantId,request.customerId()).filter(CustomerEntity::isActive).orElseThrow(()->new BadRequestException("Customer is missing or inactive"));
        SalesQuoteEntity quote=new SalesQuoteEntity(tenantId,number("QT"),customer,request.validUntil(),request.notes());
        for(QuoteLineRequest input:request.lines()){
            ItemEntity item=items.findByTenantIdAndId(tenantId,input.itemId()).filter(ItemEntity::isActive).orElseThrow(()->new BadRequestException("An item is missing or inactive"));
            quote.addLine(tenantId,item,input.quantity(),input.unitPrice());
        }
        return QuoteView.from(quotes.save(quote));
    }

    @Transactional
    public QuoteView sendQuote(UUID id){SalesQuoteEntity quote=lockQuote(id);try{quote.send();}catch(IllegalStateException e){throw new ConflictException(e.getMessage());}return QuoteView.from(quotes.save(quote));}

    @Transactional
    public QuoteView acceptQuote(UUID id){SalesQuoteEntity quote=lockQuote(id);try{quote.accept();}catch(IllegalStateException e){throw new ConflictException(e.getMessage());}return QuoteView.from(quotes.save(quote));}

    @Transactional
    public QuoteView rejectQuote(UUID id){SalesQuoteEntity quote=lockQuote(id);try{quote.reject();}catch(IllegalStateException e){throw new ConflictException(e.getMessage());}return QuoteView.from(quotes.save(quote));}

    @Transactional
    public SalesOrderView convertQuote(UUID quoteId,ConvertQuoteRequest request){
        UUID tenantId=tenant.currentTenantId();
        SalesQuoteEntity quote=lockQuote(quoteId);
        SalesOrderEntity existing=orders.findByTenantIdAndQuoteId(tenantId,quoteId).orElse(null);
        if(existing!=null)return SalesOrderView.from(existing);
        if(!quote.getStatus().equals("accepted"))throw new ConflictException("Accept the quotation before converting it to an order");
        CustomerEntity customer=quote.getCustomer();
        if(customer.isCreditHold())throw new ConflictException("This customer is on credit hold. Ask an administrator to review the account before converting the quote.");
        java.math.BigDecimal creditLimit=customer.getCreditLimit();
        if(creditLimit!=null&&creditLimit.signum()>0&&invoices.outstandingForCustomer(tenantId,customer.getId()).add(quote.getTotal()).compareTo(creditLimit)>0)throw new ConflictException("Converting this quote would exceed the customer’s credit limit.");
        WarehouseEntity defaultWarehouse=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElseThrow(()->new ConflictException("No default warehouse is configured"));
        Map<UUID,UUID> requestedWarehouses=new HashMap<>();if(request!=null&&request.lines()!=null){if(request.lines().stream().map(ReservationLine::quoteLineId).distinct().count()!=request.lines().size())throw new BadRequestException("A quotation line can only be allocated once");request.lines().forEach(line->requestedWarehouses.put(line.quoteLineId(),line.warehouseId()));}
        if(requestedWarehouses.keySet().stream().anyMatch(id->quote.getLines().stream().noneMatch(line->line.getId().equals(id))))throw new BadRequestException("Reservation includes a line outside this quotation");
        SalesOrderEntity order=new SalesOrderEntity(tenantId,number("SO"),quote,quote.getCustomer());
        List<SalesQuoteLineEntity> quoteLines=quote.getLines().stream().sorted(Comparator.comparing(line->line.getItem().getId())).toList();
        for(SalesQuoteLineEntity quoteLine:quoteLines){
            ItemEntity item=items.findActiveForUpdate(tenantId,quoteLine.getItem().getId()).orElseThrow(()->new ConflictException("An item is no longer active"));
            UUID warehouseId=requestedWarehouses.getOrDefault(quoteLine.getId(),defaultWarehouse.getId());WarehouseEntity allocationWarehouse=warehouses.findByTenantIdAndIdAndActiveTrue(tenantId,warehouseId).orElseThrow(()->new BadRequestException("Choose an active warehouse for each quotation line"));
            WarehouseStockEntity allocationBalance=warehouseStock.findForUpdate(tenantId,allocationWarehouse.getId(),item.getId()).orElseThrow(()->new ConflictException("Stock balance is missing for "+item.getSku()));
            int reserved=allocationBalance.getReservedQuantity()+allocationBalance.getManufacturingReservedQuantity();int available=allocationBalance.getOnHand()-allocationBalance.getQualityHoldQuantity()-reserved;
            if(quoteLine.getQuantity()>item.getAvailableQuantity()||quoteLine.getQuantity()>available)throw new ConflictException("Insufficient available stock in "+allocationWarehouse.getName()+" for "+item.getSku());
            item.reserveStock(quoteLine.getQuantity());
            allocationBalance.reserve(quoteLine.getQuantity());
            order.addLine(quoteLine,allocationWarehouse);
        }
        return SalesOrderView.from(orders.save(order));
    }

    @Transactional(readOnly=true)
    public List<SalesOrderView> listOrders(){return orders.findAllByTenantIdOrderByCreatedAtDesc(tenant.currentTenantId()).stream().map(SalesOrderView::from).toList();}

    @Transactional
    public ShipmentView dispatch(UUID orderId,DispatchRequest request){
        UUID tenantId=tenant.currentTenantId();
        SalesOrderEntity order=orders.findForUpdateByTenantIdAndId(tenantId,orderId).orElseThrow(()->new NotFoundException());
        SalesShipmentEntity prior=shipments.findByTenantIdAndIdempotencyKey(tenantId,request.idempotencyKey()).orElse(null);
        if(prior!=null){if(!prior.getSalesOrder().getId().equals(orderId))throw new ConflictException("Idempotency key was used for another sales order");return ShipmentView.from(prior);}
        if(!order.getStatus().equals("confirmed")&&!order.getStatus().equals("partially_shipped"))throw new ConflictException("Sales order has no reserved stock to dispatch");
        if(request.lines().stream().map(DispatchLine::salesOrderLineId).distinct().count()!=request.lines().size())throw new BadRequestException("A sales order line can only be dispatched once per shipment");
        Map<UUID,SalesOrderLineEntity> orderLines=new HashMap<>();order.getLines().forEach(line->orderLines.put(line.getId(),line));
        List<DispatchLine> inputs=new ArrayList<>(request.lines());
        for(DispatchLine input:inputs)if(!orderLines.containsKey(input.salesOrderLineId()))throw new BadRequestException("Shipment contains a line that is not on this order");
        inputs.sort(Comparator.comparing(input->orderLines.get(input.salesOrderLineId()).getItem().getId()));
        String shipmentNumber=number("SHP");
        SalesShipmentEntity shipment=new SalesShipmentEntity(tenantId,order,shipmentNumber,request.idempotencyKey());
        for(DispatchLine input:inputs){
            SalesOrderLineEntity line=orderLines.get(input.salesOrderLineId());
            if(input.quantity()>line.getReservedQuantity())throw new ConflictException("Dispatch exceeds reserved quantity for "+line.getItem().getSku());
            ItemEntity item=items.findActiveForUpdate(tenantId,line.getItem().getId()).orElseThrow(()->new ConflictException("An item is no longer active"));
            WarehouseStockEntity balance=warehouseStock.findForUpdate(tenantId,line.getWarehouse().getId(),item.getId()).orElseThrow(()->new ConflictException("Reserved warehouse stock balance is missing for "+item.getSku()));
            balance.releaseReservation(input.quantity());item.shipReservedStock(input.quantity());line.dispatch(input.quantity());shipment.addLine(line,input.quantity());
            movements.save(new InventoryMovementEntity(tenantId,item,line.getWarehouse(),-input.quantity(),"Sales dispatch",shipmentNumber,null));
        }
        order.refreshDispatchStatus();orders.save(order);
        try{return ShipmentView.from(shipments.saveAndFlush(shipment));}
        catch(DataIntegrityViolationException e){throw new ConflictException("Shipment request already exists; retry with its idempotency key");}
    }

    private SalesQuoteEntity lockQuote(UUID id){return quotes.findForUpdateByTenantIdAndId(tenant.currentTenantId(),id).orElseThrow(()->new NotFoundException());}
    private static String number(String prefix){return prefix+"-"+Year.now()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);}

    @Transactional
    public int reassignCustomerQuotes(UUID tenantId, UUID sourceId, CustomerEntity target) {
        return quotes.reassignCustomer(tenantId, sourceId, target);
    }

    @Transactional
    public int reassignCustomerOrders(UUID tenantId, UUID sourceId, CustomerEntity target) {
        return orders.reassignCustomer(tenantId, sourceId, target);
    }
}
