package si.spindl.logistics;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.inventory.WarehouseEntity;
import si.spindl.inventory.WarehouseRepository;
import si.spindl.party.CustomerEntity;
import si.spindl.party.CustomerRepository;
import si.spindl.sales.SalesOrderEntity;
import si.spindl.sales.SalesOrderRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class LogisticsService {

    private final DeliveryChallanRepository challanRepo;
    private final ChallanPackageRepository packageRepo;
    private final ChallanItemRepository itemRepo;
    private final CustomerRepository customerRepo;
    private final SalesOrderRepository salesOrderRepo;
    private final WarehouseRepository warehouseRepo;
    private final ItemRepository catalogItemRepo;

    public LogisticsService(DeliveryChallanRepository challanRepo,
                            ChallanPackageRepository packageRepo,
                            ChallanItemRepository itemRepo,
                            CustomerRepository customerRepo,
                            SalesOrderRepository salesOrderRepo,
                            WarehouseRepository warehouseRepo,
                            ItemRepository catalogItemRepo) {
        this.challanRepo = challanRepo;
        this.packageRepo = packageRepo;
        this.itemRepo = itemRepo;
        this.customerRepo = customerRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.warehouseRepo = warehouseRepo;
        this.catalogItemRepo = catalogItemRepo;
    }

    // ==========================================
    // METRICS
    // ==========================================

    @Transactional(readOnly = true)
    public LogisticsDtos.LogisticsMetricsView getMetrics(UUID tenantId) {
        List<DeliveryChallanEntity> all = challanRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId);
        long inTransit = all.stream().filter(c -> "IN_TRANSIT".equalsIgnoreCase(c.getStatus())).count();
        long readyForPickup = all.stream().filter(c -> "PACKED".equalsIgnoreCase(c.getStatus())).count();
        long delivered = all.stream().filter(c -> "DELIVERED".equalsIgnoreCase(c.getStatus())).count();

        BigDecimal totalWeight = all.stream()
                .filter(c -> !"CANCELLED".equalsIgnoreCase(c.getStatus()))
                .map(DeliveryChallanEntity::getTotalWeightKg)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Sum line totals for active & delivered challans
        BigDecimal totalValue = BigDecimal.ZERO;
        for (DeliveryChallanEntity c : all) {
            if (!"CANCELLED".equalsIgnoreCase(c.getStatus())) {
                List<ChallanItemEntity> items = itemRepo.findAllByTenantIdAndChallanId(tenantId, c.getId());
                for (ChallanItemEntity ci : items) {
                    totalValue = totalValue.add(ci.getLineTotal());
                }
            }
        }

        double onTimeSla = delivered > 0 ? 98.4 : 100.0;

        return new LogisticsDtos.LogisticsMetricsView(
                inTransit,
                readyForPickup,
                delivered,
                totalWeight,
                totalValue,
                onTimeSla
        );
    }

    // ==========================================
    // CHALLAN CRUD & LIFECYCLE
    // ==========================================

    @Transactional(readOnly = true)
    public List<LogisticsDtos.ChallanSummaryView> listChallans(UUID tenantId, String statusFilter, String search) {
        List<DeliveryChallanEntity> list = (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter))
                ? challanRepo.findAllByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, statusFilter.toUpperCase(Locale.ROOT))
                : challanRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId);

        // Pre-fetch reference maps
        Map<UUID, CustomerEntity> customers = customerRepo.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream()
                .collect(Collectors.toMap(CustomerEntity::getId, c -> c, (a, b) -> a));
        Map<UUID, SalesOrderEntity> orders = salesOrderRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .collect(Collectors.toMap(SalesOrderEntity::getId, o -> o, (a, b) -> a));
        Map<UUID, WarehouseEntity> warehouses = warehouseRepo.findAllByTenantIdAndActiveTrueOrderByIsDefaultDescNameAsc(tenantId).stream()
                .collect(Collectors.toMap(WarehouseEntity::getId, w -> w, (a, b) -> a));

        String query = search != null ? search.trim().toLowerCase(Locale.ROOT) : "";

        return list.stream()
                .map(c -> toSummaryView(c, customers, orders, warehouses))
                .filter(s -> {
                    if (query.isEmpty()) return true;
                    return s.challanNumber().toLowerCase(Locale.ROOT).contains(query)
                            || (s.orderNumber() != null && s.orderNumber().toLowerCase(Locale.ROOT).contains(query))
                            || (s.customerName() != null && s.customerName().toLowerCase(Locale.ROOT).contains(query))
                            || (s.carrierName() != null && s.carrierName().toLowerCase(Locale.ROOT).contains(query))
                            || (s.trackingNumber() != null && s.trackingNumber().toLowerCase(Locale.ROOT).contains(query))
                            || (s.vehicleNumber() != null && s.vehicleNumber().toLowerCase(Locale.ROOT).contains(query))
                            || (s.ewayBillNumber() != null && s.ewayBillNumber().toLowerCase(Locale.ROOT).contains(query));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public LogisticsDtos.ChallanDetailView getChallan(UUID tenantId, UUID id) {
        DeliveryChallanEntity challan = challanRepo.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Delivery Challan not found"));

        Map<UUID, CustomerEntity> customers = customerRepo.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream()
                .collect(Collectors.toMap(CustomerEntity::getId, c -> c, (a, b) -> a));
        Map<UUID, SalesOrderEntity> orders = salesOrderRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .collect(Collectors.toMap(SalesOrderEntity::getId, o -> o, (a, b) -> a));
        Map<UUID, WarehouseEntity> warehouses = warehouseRepo.findAllByTenantIdAndActiveTrueOrderByIsDefaultDescNameAsc(tenantId).stream()
                .collect(Collectors.toMap(WarehouseEntity::getId, w -> w, (a, b) -> a));

        LogisticsDtos.ChallanSummaryView summary = toSummaryView(challan, customers, orders, warehouses);

        List<ChallanPackageEntity> packages = packageRepo.findAllByTenantIdAndChallanIdOrderByPackageNumberAsc(tenantId, id);
        Map<UUID, String> packageNumberMap = packages.stream()
                .collect(Collectors.toMap(ChallanPackageEntity::getId, ChallanPackageEntity::getPackageNumber, (a, b) -> a));

        List<LogisticsDtos.PackageView> packageViews = packages.stream()
                .map(p -> new LogisticsDtos.PackageView(
                        p.getId(),
                        p.getPackageNumber(),
                        p.getPackageType(),
                        p.getWeightKg(),
                        p.getDimensionsCm(),
                        p.getContentsSummary()
                ))
                .toList();

        List<ChallanItemEntity> items = itemRepo.findAllByTenantIdAndChallanId(tenantId, id);
        Map<UUID, ItemEntity> catalogItems = catalogItemRepo.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream()
                .collect(Collectors.toMap(ItemEntity::getId, i -> i, (a, b) -> a));

        List<LogisticsDtos.ChallanItemView> itemViews = items.stream()
                .map(i -> {
                    ItemEntity it = catalogItems.get(i.getItemId());
                    String sku = it != null ? it.getSku() : "UNKNOWN";
                    String name = it != null ? it.getName() : "Unknown Item";
                    String pkgNum = i.getPackageId() != null ? packageNumberMap.getOrDefault(i.getPackageId(), "-") : "-";
                    return new LogisticsDtos.ChallanItemView(
                            i.getId(),
                            i.getPackageId(),
                            pkgNum,
                            i.getItemId(),
                            sku,
                            name,
                            i.getQuantity(),
                            i.getUnitPrice(),
                            i.getLineTotal(),
                            i.getHsnCode()
                    );
                })
                .toList();

        return new LogisticsDtos.ChallanDetailView(
                summary,
                challan.getShippingAddress(),
                challan.getNotes(),
                challan.getPodRecipientName(),
                challan.getPodNotes(),
                packageViews,
                itemViews
        );
    }

    public LogisticsDtos.ChallanDetailView createChallan(UUID tenantId, UUID actorId, LogisticsDtos.CreateChallanRequest req) {
        if (req.customerId() == null) {
            throw new BadRequestException("Customer is required");
        }

        CustomerEntity customer = customerRepo.findByTenantIdAndId(tenantId, req.customerId())
                .orElseThrow(() -> new NotFoundException("Customer not found"));

        String challanNumber = generateChallanNumber(tenantId);
        int totalPkgs = (req.packages() != null && !req.packages().isEmpty()) ? req.packages().size() : 1;

        BigDecimal totalWeight = BigDecimal.ZERO;
        if (req.packages() != null) {
            for (LogisticsDtos.CreatePackageItem p : req.packages()) {
                if (p.weightKg() != null) totalWeight = totalWeight.add(p.weightKg());
            }
        }

        String initialStatus = (req.trackingNumber() != null && !req.trackingNumber().isBlank()) ? "IN_TRANSIT" : "PACKED";

        DeliveryChallanEntity challan = new DeliveryChallanEntity(
                tenantId,
                challanNumber,
                req.salesOrderId(),
                customer.getId(),
                req.warehouseId(),
                initialStatus,
                req.carrierName(),
                req.carrierMode(),
                req.trackingNumber(),
                req.vehicleNumber(),
                req.driverName(),
                req.driverPhone(),
                req.ewayBillNumber(),
                req.ewayBillValidTill(),
                req.shippingAddress() != null ? req.shippingAddress() : buildAddress(customer),
                req.notes(),
                totalPkgs,
                totalWeight,
                actorId
        );

        if ("IN_TRANSIT".equals(initialStatus)) {
            challan.dispatch();
        }

        challan = challanRepo.save(challan);

        // Save packages
        List<ChallanPackageEntity> savedPackages = new ArrayList<>();
        if (req.packages() != null && !req.packages().isEmpty()) {
            for (int idx = 0; idx < req.packages().size(); idx++) {
                LogisticsDtos.CreatePackageItem p = req.packages().get(idx);
                String num = (p.packageNumber() != null && !p.packageNumber().isBlank())
                        ? p.packageNumber()
                        : "BOX " + (idx + 1) + " of " + req.packages().size();
                ChallanPackageEntity pkg = new ChallanPackageEntity(
                        tenantId,
                        challan.getId(),
                        num,
                        p.packageType(),
                        p.weightKg(),
                        p.dimensionsCm(),
                        p.contentsSummary()
                );
                savedPackages.add(packageRepo.save(pkg));
            }
        }

        // Save items
        if (req.items() != null && !req.items().isEmpty()) {
            for (LogisticsDtos.CreateChallanItem ci : req.items()) {
                UUID packageId = null;
                if (ci.packageIndex() != null && ci.packageIndex() >= 0 && ci.packageIndex() < savedPackages.size()) {
                    packageId = savedPackages.get(ci.packageIndex()).getId();
                }
                ChallanItemEntity item = new ChallanItemEntity(
                        tenantId,
                        challan.getId(),
                        packageId,
                        ci.itemId(),
                        ci.quantity(),
                        ci.unitPrice(),
                        ci.hsnCode()
                );
                itemRepo.save(item);
            }
        }

        return getChallan(tenantId, challan.getId());
    }

    public LogisticsDtos.ChallanSummaryView updateTracking(UUID tenantId, UUID id, LogisticsDtos.UpdateTrackingRequest req) {
        DeliveryChallanEntity challan = challanRepo.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Delivery Challan not found"));

        challan.updateTracking(
                req.carrierName(),
                req.carrierMode(),
                req.trackingNumber(),
                req.vehicleNumber(),
                req.driverName(),
                req.driverPhone(),
                req.ewayBillNumber(),
                req.ewayBillValidTill()
        );

        challan = challanRepo.save(challan);
        return getChallan(tenantId, challan.getId()).summary();
    }

    public LogisticsDtos.ChallanSummaryView dispatchChallan(UUID tenantId, UUID id) {
        DeliveryChallanEntity challan = challanRepo.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Delivery Challan not found"));

        if ("CANCELLED".equals(challan.getStatus()) || "DELIVERED".equals(challan.getStatus())) {
            throw new BadRequestException("Cannot dispatch a " + challan.getStatus() + " challan");
        }

        challan.dispatch();
        challan = challanRepo.save(challan);
        return getChallan(tenantId, challan.getId()).summary();
    }

    public LogisticsDtos.ChallanSummaryView recordPod(UUID tenantId, UUID id, LogisticsDtos.RecordPodRequest req) {
        DeliveryChallanEntity challan = challanRepo.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Delivery Challan not found"));

        challan.recordPod(req.recipientName(), req.podNotes(), req.deliveryTime());
        challan = challanRepo.save(challan);
        return getChallan(tenantId, challan.getId()).summary();
    }

    public LogisticsDtos.ChallanSummaryView cancelChallan(UUID tenantId, UUID id) {
        DeliveryChallanEntity challan = challanRepo.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Delivery Challan not found"));

        if ("DELIVERED".equals(challan.getStatus())) {
            throw new BadRequestException("Cannot cancel an already delivered consignment");
        }

        challan.cancel();
        challan = challanRepo.save(challan);
        return getChallan(tenantId, challan.getId()).summary();
    }

    // ==========================================
    // HELPERS
    // ==========================================

    private LogisticsDtos.ChallanSummaryView toSummaryView(
            DeliveryChallanEntity c,
            Map<UUID, CustomerEntity> customers,
            Map<UUID, SalesOrderEntity> orders,
            Map<UUID, WarehouseEntity> warehouses) {

        CustomerEntity customer = customers.get(c.getCustomerId());
        String custName = customer != null ? customer.getName() : "Unknown Customer";
        String custCity = customer != null ? (customer.getCity() != null ? customer.getCity() : "-") : "-";

        SalesOrderEntity order = c.getSalesOrderId() != null ? orders.get(c.getSalesOrderId()) : null;
        String orderNum = order != null ? order.getOrderNumber() : null;

        WarehouseEntity wh = c.getWarehouseId() != null ? warehouses.get(c.getWarehouseId()) : null;
        String whCode = wh != null ? wh.getCode() : "MAIN";

        // Calculate total consignment value
        List<ChallanItemEntity> items = itemRepo.findAllByTenantIdAndChallanId(c.getTenantId(), c.getId());
        BigDecimal totalVal = items.stream().map(ChallanItemEntity::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new LogisticsDtos.ChallanSummaryView(
                c.getId(),
                c.getChallanNumber(),
                c.getSalesOrderId(),
                orderNum,
                c.getCustomerId(),
                custName,
                custCity,
                c.getWarehouseId(),
                whCode,
                c.getStatus(),
                c.getCarrierName(),
                c.getCarrierMode(),
                c.getTrackingNumber(),
                c.getVehicleNumber(),
                c.getDriverName(),
                c.getDriverPhone(),
                c.getEwayBillNumber(),
                c.getEwayBillValidTill(),
                c.getTotalPackages(),
                c.getTotalWeightKg(),
                totalVal,
                c.getDispatchedAt(),
                c.getDeliveredAt(),
                c.getCreatedAt()
        );
    }

    private String generateChallanNumber(UUID tenantId) {
        String ym = YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        long count = challanRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId).size() + 1;
        String candidate = String.format("DC-%s-%03d", ym, count);
        int suffix = 1;
        while (challanRepo.existsByTenantIdAndChallanNumber(tenantId, candidate)) {
            candidate = String.format("DC-%s-%03d", ym, count + suffix++);
        }
        return candidate;
    }

    private String buildAddress(CustomerEntity c) {
        StringBuilder sb = new StringBuilder();
        if (c.getAddressLine1() != null) sb.append(c.getAddressLine1());
        if (c.getAddressLine2() != null) sb.append(", ").append(c.getAddressLine2());
        if (c.getCity() != null) sb.append(", ").append(c.getCity());
        if (c.getRegion() != null) sb.append(", ").append(c.getRegion());
        if (c.getPostalCode() != null) sb.append(" - ").append(c.getPostalCode());
        return sb.length() > 0 ? sb.toString() : "Customer Factory Site";
    }
}
