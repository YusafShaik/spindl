package si.spindl.mrp;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.catalog.WarehouseEntity;
import si.spindl.catalog.WarehouseRepository;
import si.spindl.identity.AppUserEntity;
import si.spindl.identity.AppUserRepository;
import si.spindl.manufacturing.*;
import si.spindl.purchasing.PurchaseOrderEntity;
import si.spindl.purchasing.PurchaseOrderRepository;
import si.spindl.purchasing.SupplierEntity;
import si.spindl.purchasing.SupplierRepository;
import si.spindl.sales.SalesOrderEntity;
import si.spindl.sales.SalesOrderLineEntity;
import si.spindl.sales.SalesOrderRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MrpService {

    private final MrpRunRepository mrpRuns;
    private final MrpPlannedOrderRepository mrpPlannedOrders;
    private final ItemRepository items;
    private final BomRepository boms;
    private final BomLineRepository bomLines;
    private final SupplierRepository suppliers;
    private final WarehouseRepository warehouses;
    private final SalesOrderRepository salesOrders;
    private final WorkOrderRepository workOrders;
    private final PurchaseOrderRepository purchaseOrders;
    private final AppUserRepository users;
    private final WorkOrderService workOrderService;

    public MrpService(
            MrpRunRepository mrpRuns,
            MrpPlannedOrderRepository mrpPlannedOrders,
            ItemRepository items,
            BomRepository boms,
            BomLineRepository bomLines,
            SupplierRepository suppliers,
            WarehouseRepository warehouses,
            SalesOrderRepository salesOrders,
            WorkOrderRepository workOrders,
            PurchaseOrderRepository purchaseOrders,
            AppUserRepository users,
            WorkOrderService workOrderService
    ) {
        this.mrpRuns = mrpRuns;
        this.mrpPlannedOrders = mrpPlannedOrders;
        this.items = items;
        this.boms = boms;
        this.bomLines = bomLines;
        this.suppliers = suppliers;
        this.warehouses = warehouses;
        this.salesOrders = salesOrders;
        this.workOrders = workOrders;
        this.purchaseOrders = purchaseOrders;
        this.users = users;
        this.workOrderService = workOrderService;
    }

    // ==========================================
    // RUNS & METRICS
    // ==========================================

    public List<MrpDtos.MrpRunView> listRuns(UUID tenantId) {
        return mrpRuns.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(MrpDtos.MrpRunView::from)
                .toList();
    }

    public MrpDtos.MrpRunView getRun(UUID tenantId, UUID runId) {
        MrpRunEntity run = mrpRuns.findByTenantIdAndId(tenantId, runId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "MRP Run not found"));
        return MrpDtos.MrpRunView.from(run);
    }

    public MrpDtos.MrpMetricsView getMetrics(UUID tenantId) {
        long totalRuns = mrpRuns.countByTenantId(tenantId);
        long openShortages = mrpPlannedOrders.countByTenantIdAndStatus(tenantId, "PENDING");
        long plannedPurchases = mrpPlannedOrders.countByTenantIdAndActionTypeAndStatus(tenantId, "PURCHASE_ORDER", "PENDING");
        long plannedWorkOrders = mrpPlannedOrders.countByTenantIdAndActionTypeAndStatus(tenantId, "WORK_ORDER", "PENDING");
        BigDecimal totalSpend = mrpPlannedOrders.calculateTotalPendingSpend(tenantId);
        long convertedOrders = mrpPlannedOrders.countByTenantIdAndStatus(tenantId, "CONVERTED");

        return new MrpDtos.MrpMetricsView(
                totalRuns,
                openShortages,
                plannedPurchases,
                plannedWorkOrders,
                totalSpend != null ? totalSpend : BigDecimal.ZERO,
                convertedOrders
        );
    }

    // ==========================================
    // PLANNED ORDERS
    // ==========================================

    public List<MrpDtos.PlannedOrderView> listPlannedOrders(UUID tenantId, UUID runId, String status, String actionType) {
        List<MrpPlannedOrderEntity> orders;
        if (runId != null) {
            orders = mrpPlannedOrders.findAllByTenantIdAndMrpRunIdOrderByRequiredByDateAsc(tenantId, runId);
        } else if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            orders = mrpPlannedOrders.findAllByTenantIdAndStatusOrderByRequiredByDateAsc(tenantId, status.toUpperCase());
        } else {
            orders = mrpPlannedOrders.findAllByTenantIdOrderByRequiredByDateAsc(tenantId);
        }

        return orders.stream()
                .filter(o -> actionType == null || actionType.isBlank() || "ALL".equalsIgnoreCase(actionType) || o.getActionType().equalsIgnoreCase(actionType))
                .map(MrpDtos.PlannedOrderView::from)
                .toList();
    }

    public MrpDtos.PlannedOrderView getPlannedOrder(UUID tenantId, UUID id) {
        MrpPlannedOrderEntity order = mrpPlannedOrders.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Planned order not found"));
        return MrpDtos.PlannedOrderView.from(order);
    }

    // ==========================================
    // TIME-PHASED SCHEDULE MATRIX
    // ==========================================

    public List<MrpDtos.TimePhasedMatrixRow> getTimePhasedSchedule(UUID tenantId, Integer horizonWeeks) {
        int weeks = (horizonWeeks == null || horizonWeeks < 1) ? 5 : Math.min(horizonWeeks, 8);
        LocalDate today = LocalDate.now();

        List<ItemEntity> allItems = items.findAllByTenantIdAndActiveTrueOrderByName(tenantId);
        List<SalesOrderEntity> openSales = salesOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(so -> "confirmed".equalsIgnoreCase(so.getStatus()) || "partially_shipped".equalsIgnoreCase(so.getStatus()))
                .toList();
        List<WorkOrderEntity> activeWorkOrders = workOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(wo -> "RELEASED".equalsIgnoreCase(wo.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(wo.getStatus()) || "DRAFT".equalsIgnoreCase(wo.getStatus()))
                .toList();
        List<PurchaseOrderEntity> openPurchaseOrders = purchaseOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(po -> "approved".equalsIgnoreCase(po.getStatus()) || "ordered".equalsIgnoreCase(po.getStatus()))
                .toList();

        List<MrpDtos.TimePhasedMatrixRow> rows = new ArrayList<>();

        for (ItemEntity item : allItems) {
            // Find if item has an approved BOM
            List<BomEntity> bomsForItem = boms.findEffectiveApproved(tenantId, item.getId());
            boolean isManufactured = !bomsForItem.isEmpty();
            String actionType = isManufactured ? "WORK_ORDER" : "PURCHASE_ORDER";
            int leadTimeDays = isManufactured ? 5 : 14;

            int onHand = item.getOnHand();
            int safetyStock = item.getLowStockThreshold();
            int currentProjectedAvailable = onHand;

            List<MrpDtos.TimePhasedBucket> buckets = new ArrayList<>();

            for (int w = 0; w < weeks; w++) {
                LocalDate bucketStart = today.plusDays((long) w * 7);
                LocalDate bucketEnd = bucketStart.plusDays(6);
                String label = w == 0 ? "Current Week (W0)" : "Week +" + w + " (" + bucketStart.format(DateTimeFormatter.ofPattern("dd MMM")) + ")";

                // 1. Gross Demand in this bucket
                int bucketGrossDemand = 0;
                // Demand from Sales Orders
                for (SalesOrderEntity so : openSales) {
                    LocalDate orderDate = LocalDate.ofInstant(so.getCreatedAt(), java.time.ZoneOffset.UTC);
                    // Match order timing bucket or allocate past/current demand to W0
                    boolean belongsToBucket = (w == 0 && !orderDate.isAfter(bucketEnd)) ||
                            (!orderDate.isBefore(bucketStart) && !orderDate.isAfter(bucketEnd));
                    if (belongsToBucket) {
                        for (SalesOrderLineEntity line : so.getLines()) {
                            if (line.getItem().getId().equals(item.getId())) {
                                bucketGrossDemand += Math.max(0, line.getQuantity() - line.getShippedQuantity());
                            }
                        }
                    }
                }

                // 2. Scheduled Receipts in this bucket
                int scheduledReceipts = 0;
                if (!isManufactured) {
                    for (PurchaseOrderEntity po : openPurchaseOrders) {
                        LocalDate poDate = LocalDate.ofInstant(po.getCreatedAt(), java.time.ZoneOffset.UTC);
                        boolean belongsToBucket = (w == 0 && !poDate.isAfter(bucketEnd)) ||
                                (!poDate.isBefore(bucketStart) && !poDate.isAfter(bucketEnd));
                        if (belongsToBucket) {
                            for (var l : po.getLines()) {
                                if (l.getItem().getId().equals(item.getId())) {
                                    scheduledReceipts += Math.max(0, l.getOrderedQuantity() - l.getReceivedQuantity());
                                }
                            }
                        }
                    }
                } else {
                    for (WorkOrderEntity wo : activeWorkOrders) {
                        if (wo.getFinishedItemId().equals(item.getId())) {
                            LocalDate dueDate = wo.getDueDate() != null ? wo.getDueDate() : today;
                            boolean belongsToBucket = (w == 0 && !dueDate.isAfter(bucketEnd)) ||
                                    (!dueDate.isBefore(bucketStart) && !dueDate.isAfter(bucketEnd));
                            if (belongsToBucket) {
                                scheduledReceipts += Math.max(0, wo.getTargetQuantity() - wo.getGoodQuantity());
                            }
                        }
                    }
                }

                // 3. Projected Available Balance & Net Requirement
                int balanceBeforeReplenish = currentProjectedAvailable + scheduledReceipts - bucketGrossDemand;
                int netRequirement = 0;
                int plannedRelease = 0;

                if (balanceBeforeReplenish < safetyStock) {
                    netRequirement = safetyStock - balanceBeforeReplenish;
                    plannedRelease = netRequirement;
                    currentProjectedAvailable = safetyStock;
                } else {
                    currentProjectedAvailable = balanceBeforeReplenish;
                }

                buckets.add(new MrpDtos.TimePhasedBucket(
                        label,
                        bucketStart,
                        bucketEnd,
                        bucketGrossDemand,
                        scheduledReceipts,
                        currentProjectedAvailable,
                        netRequirement,
                        plannedRelease
                ));
            }

            rows.add(new MrpDtos.TimePhasedMatrixRow(
                    item.getId(),
                    item.getSku(),
                    item.getName(),
                    item.getUnit(),
                    item.getItemType(),
                    onHand,
                    safetyStock,
                    leadTimeDays,
                    actionType,
                    buckets
            ));
        }

        return rows;
    }

    // ==========================================
    // BOM EXPLOSION TREE
    // ==========================================

    public MrpDtos.BomExplosionNode getBomExplosion(UUID tenantId, UUID itemId) {
        ItemEntity rootItem = items.findByTenantIdAndId(tenantId, itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        return buildBomNode(tenantId, rootItem, 0, 1, BigDecimal.ZERO, new HashSet<>());
    }

    private MrpDtos.BomExplosionNode buildBomNode(
            UUID tenantId,
            ItemEntity item,
            int level,
            int qtyPerUnit,
            BigDecimal scrapPercent,
            Set<UUID> visited
    ) {
        visited.add(item.getId());
        List<BomEntity> effectiveBoms = boms.findEffectiveApproved(tenantId, item.getId());
        boolean hasBom = !effectiveBoms.isEmpty();
        String actionType = hasBom ? "WORK_ORDER" : "PURCHASE_ORDER";
        int leadTimeDays = hasBom ? 5 : 14;

        int onHand = item.getOnHand();
        int available = item.getAvailableQuantity();
        int netShortage = Math.max(0, item.getLowStockThreshold() - available);

        List<MrpDtos.BomExplosionNode> children = new ArrayList<>();
        if (hasBom) {
            BomEntity bom = effectiveBoms.getFirst();
            List<BomLineEntity> lines = bomLines.findAllByTenantIdAndBomIdOrderById(tenantId, bom.getId());
            for (BomLineEntity line : lines) {
                if (!visited.contains(line.getComponentItemId())) {
                    items.findByTenantIdAndId(tenantId, line.getComponentItemId()).ifPresent(compItem -> {
                        children.add(buildBomNode(
                                tenantId,
                                compItem,
                                level + 1,
                                line.getQuantityPerUnit(),
                                line.getScrapAllowancePercent(),
                                new HashSet<>(visited)
                        ));
                    });
                }
            }
        }

        return new MrpDtos.BomExplosionNode(
                item.getId(),
                item.getSku(),
                item.getName(),
                level,
                item.getItemType(),
                qtyPerUnit,
                scrapPercent != null ? scrapPercent : BigDecimal.ZERO,
                leadTimeDays,
                onHand,
                available,
                netShortage,
                actionType,
                children
        );
    }

    // ==========================================
    // EXECUTE MRP ENGINE
    // ==========================================

    @Transactional
    public MrpDtos.MrpRunView calculateMrp(UUID tenantId, UUID actorId, MrpDtos.CalculateMrpRequest request) {
        int horizon = (request != null && request.planningHorizonWeeks() != null) ? request.planningHorizonWeeks() : 4;
        boolean includeSafety = request == null || request.includeSafetyStock() == null || Boolean.TRUE.equals(request.includeSafetyStock());
        String notes = request != null && request.notes() != null ? request.notes() : "Automated MRP-II engine calculation run";

        AppUserEntity actor = actorId != null ? users.findById(actorId).orElse(null) : null;

        // Generate unique Run Number e.g. MRP-202611-A1B2C3
        String runNumber = "MRP-" + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM")) + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);

        MrpRunEntity run = new MrpRunEntity(tenantId, runNumber, horizon, notes, actor);
        run = mrpRuns.save(run);

        // Fetch suppliers for default supplier assignment
        List<SupplierEntity> activeSuppliers = suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenantId);
        SupplierEntity defaultSupplier = activeSuppliers.isEmpty() ? null : activeSuppliers.getFirst();

        // 1. Calculate Gross Demands across all Items
        List<ItemEntity> allItems = items.findAllByTenantIdAndActiveTrueOrderByName(tenantId);
        Map<UUID, Integer> grossDemands = new HashMap<>();
        Map<UUID, String> demandSources = new HashMap<>();

        // Sales Demand
        List<SalesOrderEntity> openSales = salesOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(so -> "confirmed".equalsIgnoreCase(so.getStatus()) || "partially_shipped".equalsIgnoreCase(so.getStatus()))
                .toList();

        for (SalesOrderEntity so : openSales) {
            for (SalesOrderLineEntity line : so.getLines()) {
                int openQty = Math.max(0, line.getQuantity() - line.getShippedQuantity());
                if (openQty > 0) {
                    grossDemands.merge(line.getItem().getId(), openQty, Integer::sum);
                    demandSources.put(line.getItem().getId(), "SALES_ORDER (" + so.getOrderNumber() + ")");
                }
            }
        }

        // Dependent Component Demands from active Work Orders
        List<WorkOrderEntity> activeWorkOrders = workOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(wo -> "RELEASED".equalsIgnoreCase(wo.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(wo.getStatus()))
                .toList();

        for (WorkOrderEntity wo : activeWorkOrders) {
            List<BomLineEntity> lines = bomLines.findAllByTenantIdAndBomIdOrderById(tenantId, wo.getBomId());
            for (BomLineEntity bl : lines) {
                int pendingMultiplier = Math.max(0, wo.getTargetQuantity() - wo.getGoodQuantity());
                int compReq = pendingMultiplier * bl.getQuantityPerUnit();
                if (bl.getScrapAllowancePercent() != null && bl.getScrapAllowancePercent().compareTo(BigDecimal.ZERO) > 0) {
                    compReq += (int) Math.ceil(compReq * (bl.getScrapAllowancePercent().doubleValue() / 100.0));
                }
                grossDemands.merge(bl.getComponentItemId(), compReq, Integer::sum);
                demandSources.putIfAbsent(bl.getComponentItemId(), "WO_COMPONENT (" + wo.getOrderNumber() + ")");
            }
        }

        // Scheduled Inbound Receipts
        Map<UUID, Integer> scheduledReceipts = new HashMap<>();
        purchaseOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(po -> "approved".equalsIgnoreCase(po.getStatus()) || "ordered".equalsIgnoreCase(po.getStatus()))
                .forEach(po -> po.getLines().forEach(line -> {
                    int inbound = Math.max(0, line.getOrderedQuantity() - line.getReceivedQuantity());
                    if (inbound > 0) {
                        scheduledReceipts.merge(line.getItem().getId(), inbound, Integer::sum);
                    }
                }));

        // 2. Compute Net Requirements & Generate Recommendations
        LocalDate today = LocalDate.now();

        for (ItemEntity item : allItems) {
            int grossDemand = grossDemands.getOrDefault(item.getId(), 0);
            int safetyStock = includeSafety ? item.getLowStockThreshold() : 0;
            int onHand = item.getOnHand();
            int allocated = item.getReservedQuantity() + item.getManufacturingReservedQuantity();
            int inbound = scheduledReceipts.getOrDefault(item.getId(), 0);

            int netAvailable = (onHand - allocated) + inbound;
            int totalRequirement = grossDemand + safetyStock;
            int netShortage = Math.max(0, totalRequirement - netAvailable);

            if (netShortage > 0) {
                List<BomEntity> effectiveBoms = boms.findEffectiveApproved(tenantId, item.getId());
                boolean isManufactured = !effectiveBoms.isEmpty();

                String actionType = isManufactured ? "WORK_ORDER" : "PURCHASE_ORDER";
                BomEntity bom = isManufactured ? effectiveBoms.getFirst() : null;
                SupplierEntity supplier = !isManufactured ? defaultSupplier : null;

                int leadTimeDays = isManufactured ? 5 : (supplier != null && supplier.getLeadTimeDays() > 0 ? supplier.getLeadTimeDays() : 14);
                LocalDate requiredDate = today.plusDays(leadTimeDays + 3);
                LocalDate orderDate = requiredDate.minusDays(leadTimeDays);

                String urgency;
                if (!orderDate.isAfter(today)) {
                    urgency = "CRITICAL";
                } else if (!orderDate.isAfter(today.plusDays(7))) {
                    urgency = "HIGH";
                } else {
                    urgency = "MEDIUM";
                }

                String source = demandSources.getOrDefault(item.getId(), "SAFETY_STOCK");
                String sourceRef = source.equals("SAFETY_STOCK")
                        ? "Below Safety Threshold (" + onHand + " on hand vs " + safetyStock + " min)"
                        : "Required by " + source;

                BigDecimal unitCost = item.getUnitPrice();
                if (isManufactured) {
                    unitCost = unitCost.multiply(BigDecimal.valueOf(0.40)); // standard conversion cost baseline
                }

                MrpPlannedOrderEntity plannedOrder = new MrpPlannedOrderEntity(
                        tenantId,
                        run,
                        item,
                        actionType,
                        bom,
                        supplier,
                        netShortage,
                        orderDate,
                        requiredDate,
                        leadTimeDays,
                        unitCost,
                        urgency,
                        source.startsWith("SALES_ORDER") ? "SALES_ORDER" : source.startsWith("WO_COMPONENT") ? "WORK_ORDER_COMPONENT" : "SAFETY_STOCK",
                        sourceRef
                );

                run.addPlannedOrder(plannedOrder);
            }
        }

        run.recalculateTotals();
        mrpRuns.save(run);

        return MrpDtos.MrpRunView.from(run);
    }

    // ==========================================
    // 1-CLICK BATCH CONVERSION
    // ==========================================

    @Transactional
    public MrpDtos.PlannedOrderView convertPlannedOrder(UUID tenantId, UUID actorId, UUID orderId) {
        MrpPlannedOrderEntity plannedOrder = mrpPlannedOrders.findByTenantIdAndId(tenantId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Planned order not found"));

        if ("CONVERTED".equalsIgnoreCase(plannedOrder.getStatus())) {
            return MrpDtos.PlannedOrderView.from(plannedOrder);
        }

        if ("PURCHASE_ORDER".equalsIgnoreCase(plannedOrder.getActionType())) {
            SupplierEntity supplier = plannedOrder.getSuggestedSupplier();
            if (supplier == null) {
                supplier = suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenantId).stream()
                        .findFirst()
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active supplier available for purchase conversion"));
            }

            String poNumber = "PO-" + LocalDate.now().toString().replace("-", "") + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            PurchaseOrderEntity po = new PurchaseOrderEntity(
                    tenantId,
                    poNumber,
                    supplier,
                    "Converted from MRP Recommendation (" + plannedOrder.getMrpRun().getRunNumber() + "): " + plannedOrder.getDemandSourceRef(),
                    actorId
            );
            po.addLine(plannedOrder.getItem(), plannedOrder.getRecommendedQuantity(), plannedOrder.getEstimatedUnitCost());
            po = purchaseOrders.save(po);

            plannedOrder.markConverted(po.getId(), po.getOrderNumber());
        } else if ("WORK_ORDER".equalsIgnoreCase(plannedOrder.getActionType())) {
            if (plannedOrder.getBom() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No approved BOM associated with this planned work order");
            }

            WarehouseEntity defaultWarehouse = warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId)
                    .orElseGet(() -> warehouses.findAllByTenantIdAndActiveTrueOrderByIsDefaultDescNameAsc(tenantId).getFirst());

            String idempotencyKey = "MRP-WO-" + plannedOrder.getId().toString();
            var woView = workOrderService.create(
                    tenantId,
                    actorId,
                    new ManufacturingDtos.CreateWorkOrderRequest(
                            plannedOrder.getBom().getId(),
                            plannedOrder.getRecommendedQuantity(),
                            idempotencyKey,
                            plannedOrder.getRecommendedOrderDate(),
                            plannedOrder.getRequiredByDate(),
                            "HIGH".equalsIgnoreCase(plannedOrder.getUrgency()) || "CRITICAL".equalsIgnoreCase(plannedOrder.getUrgency()) ? "HIGH" : "NORMAL",
                            defaultWarehouse.getId(),
                            null,
                            null
                    )
            );

            plannedOrder.markConverted(woView.id(), woView.orderNumber());
        }

        mrpPlannedOrders.save(plannedOrder);
        return MrpDtos.PlannedOrderView.from(plannedOrder);
    }

    @Transactional
    public MrpDtos.BatchConvertResponse convertBatch(UUID tenantId, UUID actorId, MrpDtos.BatchConvertRequest request) {
        int converted = 0;
        int failed = 0;
        List<String> orderNumbers = new ArrayList<>();
        List<String> messages = new ArrayList<>();

        for (UUID id : request.orderIds()) {
            try {
                MrpDtos.PlannedOrderView view = convertPlannedOrder(tenantId, actorId, id);
                converted++;
                if (view.convertedOrderNumber() != null) {
                    orderNumbers.add(view.convertedOrderNumber());
                }
                messages.add("Successfully converted " + view.sku() + " to " + view.actionType() + " (" + view.convertedOrderNumber() + ")");
            } catch (Exception e) {
                failed++;
                messages.add("Failed to convert planned order " + id + ": " + e.getMessage());
            }
        }

        return new MrpDtos.BatchConvertResponse(converted, failed, orderNumbers, messages);
    }

    @Transactional
    public MrpDtos.PlannedOrderView dismissPlannedOrder(UUID tenantId, UUID orderId) {
        MrpPlannedOrderEntity plannedOrder = mrpPlannedOrders.findByTenantIdAndId(tenantId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Planned order not found"));
        plannedOrder.markDismissed();
        mrpPlannedOrders.save(plannedOrder);
        return MrpDtos.PlannedOrderView.from(plannedOrder);
    }
}
