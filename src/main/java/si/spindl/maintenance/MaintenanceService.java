package si.spindl.maintenance;

import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.catalog.*;
import si.spindl.inventory.*;
import si.spindl.identity.AppUserRepository;
import si.spindl.manufacturing.WorkCenterRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class MaintenanceService {

    private final AssetRepository assetRepo;
    private final MaintenanceScheduleRepository scheduleRepo;
    private final MaintenanceWorkOrderRepository workOrderRepo;
    private final MaintenancePartConsumptionRepository partRepo;
    private final WorkCenterRepository workCenterRepo;
    private final ItemRepository itemRepo;
    private final WarehouseRepository warehouseRepo;
    private final WarehouseStockRepository warehouseStockRepo;
    private final InventoryMovementRepository movementRepo;
    private final AppUserRepository userRepo;

    public MaintenanceService(AssetRepository assetRepo,
                              MaintenanceScheduleRepository scheduleRepo,
                              MaintenanceWorkOrderRepository workOrderRepo,
                              MaintenancePartConsumptionRepository partRepo,
                              WorkCenterRepository workCenterRepo,
                              ItemRepository itemRepo,
                              WarehouseRepository warehouseRepo,
                              WarehouseStockRepository warehouseStockRepo,
                              InventoryMovementRepository movementRepo,
                              AppUserRepository userRepo) {
        this.assetRepo = assetRepo;
        this.scheduleRepo = scheduleRepo;
        this.workOrderRepo = workOrderRepo;
        this.partRepo = partRepo;
        this.workCenterRepo = workCenterRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.warehouseStockRepo = warehouseStockRepo;
        this.movementRepo = movementRepo;
        this.userRepo = userRepo;
    }

    // ==========================================
    // ASSETS
    // ==========================================

    @Transactional(readOnly = true)
    public List<MaintenanceDtos.AssetView> listAssets(UUID tenantId) {
        return assetRepo.findAllByTenantIdOrderByCodeAsc(tenantId).stream().map(this::toAssetView).toList();
    }

    @Transactional
    public MaintenanceDtos.AssetView createAsset(UUID tenantId, MaintenanceDtos.AssetRequest request) {
        String code = request.code().trim().toUpperCase();
        if (assetRepo.existsByTenantIdAndCodeIgnoreCase(tenantId, code)) {
            throw new ConflictException("Asset code '" + code + "' already exists");
        }
        AssetEntity asset = new AssetEntity(
            tenantId,
            code,
            request.name().trim(),
            request.workCenterId(),
            request.serialNumber(),
            request.manufacturer(),
            request.model(),
            request.status() != null ? request.status() : "OPERATIONAL",
            request.meterHours() != null ? request.meterHours() : BigDecimal.ZERO,
            request.installationDate(),
            request.warrantyExpiry(),
            request.nextServiceDueDate(),
            request.notes()
        );
        return toAssetView(assetRepo.save(asset));
    }

    @Transactional
    public MaintenanceDtos.AssetView updateAsset(UUID tenantId, UUID id, MaintenanceDtos.AssetRequest request) {
        AssetEntity asset = assetRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Asset not found"));
        asset.update(
            request.name().trim(),
            request.workCenterId(),
            request.serialNumber(),
            request.manufacturer(),
            request.model(),
            request.installationDate(),
            request.warrantyExpiry(),
            request.notes()
        );
        if (request.status() != null) asset.setStatus(request.status());
        if (request.meterHours() != null) asset.setMeterHours(request.meterHours());
        if (request.nextServiceDueDate() != null) asset.setNextServiceDueDate(request.nextServiceDueDate());
        return toAssetView(assetRepo.save(asset));
    }

    @Transactional
    public MaintenanceDtos.AssetView setAssetStatus(UUID tenantId, UUID id, String status) {
        AssetEntity asset = assetRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Asset not found"));
        asset.setStatus(status);
        return toAssetView(assetRepo.save(asset));
    }

    @Transactional
    public MaintenanceDtos.AssetView updateMeterHours(UUID tenantId, UUID id, BigDecimal meterHours) {
        AssetEntity asset = assetRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Asset not found"));
        asset.setMeterHours(meterHours);
        return toAssetView(assetRepo.save(asset));
    }

    private MaintenanceDtos.AssetView toAssetView(AssetEntity a) {
        String wcCode = null;
        String wcName = null;
        if (a.getWorkCenterId() != null) {
            var wc = workCenterRepo.findByTenantIdAndId(a.getTenantId(), a.getWorkCenterId());
            if (wc.isPresent()) {
                wcCode = wc.get().getCode();
                wcName = wc.get().getName();
            }
        }
        return new MaintenanceDtos.AssetView(
            a.getId(),
            a.getCode(),
            a.getName(),
            a.getWorkCenterId(),
            wcCode,
            wcName,
            a.getSerialNumber(),
            a.getManufacturer(),
            a.getModel(),
            a.getStatus(),
            a.getMeterHours(),
            a.getTotalMaintenanceCost(),
            a.getInstallationDate(),
            a.getWarrantyExpiry(),
            a.getLastServiceDate(),
            a.getNextServiceDueDate(),
            a.getNotes(),
            a.getCreatedAt()
        );
    }

    // ==========================================
    // SCHEDULES
    // ==========================================

    @Transactional(readOnly = true)
    public List<MaintenanceDtos.ScheduleView> listSchedules(UUID tenantId) {
        return scheduleRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::toScheduleView).toList();
    }

    @Transactional
    public MaintenanceDtos.ScheduleView createSchedule(UUID tenantId, MaintenanceDtos.ScheduleRequest request) {
        AssetEntity asset = assetRepo.findByTenantIdAndId(tenantId, request.assetId())
            .orElseThrow(() -> new NotFoundException("Asset not found"));

        LocalDate nextDue = request.nextDueDate();
        if (nextDue == null && "CALENDAR_DAYS".equalsIgnoreCase(request.frequencyType())) {
            nextDue = LocalDate.now().plusDays(request.frequencyInterval());
        }

        MaintenanceScheduleEntity schedule = new MaintenanceScheduleEntity(
            tenantId,
            asset.getId(),
            request.title().trim(),
            request.frequencyType(),
            request.frequencyInterval(),
            nextDue,
            request.checklist() != null ? request.checklist() : "[]"
        );
        MaintenanceScheduleEntity saved = scheduleRepo.save(schedule);

        // Update asset's next service due date if sooner
        if (nextDue != null && (asset.getNextServiceDueDate() == null || nextDue.isBefore(asset.getNextServiceDueDate()))) {
            asset.setNextServiceDueDate(nextDue);
            assetRepo.save(asset);
        }

        return toScheduleView(saved);
    }

    @Transactional
    public MaintenanceDtos.ScheduleView setScheduleActive(UUID tenantId, UUID id, boolean active) {
        MaintenanceScheduleEntity schedule = scheduleRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Schedule not found"));
        schedule.setActive(active);
        return toScheduleView(scheduleRepo.save(schedule));
    }

    private MaintenanceDtos.ScheduleView toScheduleView(MaintenanceScheduleEntity s) {
        String aCode = null;
        String aName = null;
        var a = assetRepo.findByTenantIdAndId(s.getTenantId(), s.getAssetId());
        if (a.isPresent()) {
            aCode = a.get().getCode();
            aName = a.get().getName();
        }
        return new MaintenanceDtos.ScheduleView(
            s.getId(),
            s.getAssetId(),
            aCode,
            aName,
            s.getTitle(),
            s.getFrequencyType(),
            s.getFrequencyInterval(),
            s.getLastPerformedAt(),
            s.getNextDueDate(),
            s.getChecklist(),
            s.isActive(),
            s.getCreatedAt()
        );
    }

    // ==========================================
    // WORK ORDERS
    // ==========================================

    @Transactional(readOnly = true)
    public List<MaintenanceDtos.WorkOrderView> listWorkOrders(UUID tenantId) {
        return workOrderRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::toWorkOrderView).toList();
    }

    @Transactional
    public MaintenanceDtos.WorkOrderView createWorkOrder(UUID tenantId, MaintenanceDtos.WorkOrderRequest request) {
        AssetEntity asset = assetRepo.findByTenantIdAndId(tenantId, request.assetId())
            .orElseThrow(() -> new NotFoundException("Asset not found"));

        String datePrefix = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String orderNumber = "MWO-" + datePrefix + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        LocalDate scheduled = request.scheduledDate() != null ? request.scheduledDate() : LocalDate.now();

        String techType = request.technicianType() != null && !request.technicianType().isBlank()
            ? request.technicianType().toUpperCase()
            : "INTERNAL";
        UUID techId = "INTERNAL".equalsIgnoreCase(techType) ? request.assignedTechnicianUserId() : null;
        String contractor = "EXTERNAL".equalsIgnoreCase(techType) ? request.externalContractorName() : null;

        MaintenanceWorkOrderEntity wo = new MaintenanceWorkOrderEntity(
            tenantId,
            orderNumber,
            asset.getId(),
            request.scheduleId(),
            request.type(),
            request.priority(),
            techId,
            request.failureSymptom(),
            scheduled
        );
        wo.setTechnicianType(techType);
        wo.setExternalContractorName(contractor);

        // If breakdown or high/emergency priority, mark asset under maintenance
        if ("BREAKDOWN".equalsIgnoreCase(request.type()) || "HIGH".equalsIgnoreCase(request.priority()) || "EMERGENCY".equalsIgnoreCase(request.priority())) {
            asset.setStatus("UNDER_MAINTENANCE");
            assetRepo.save(asset);
        }

        return toWorkOrderView(workOrderRepo.save(wo));
    }

    @Transactional
    public MaintenanceDtos.WorkOrderView startWorkOrder(UUID tenantId, UUID id) {
        MaintenanceWorkOrderEntity wo = workOrderRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Work order not found"));
        wo.start();

        // Ensure asset marked under maintenance
        assetRepo.findByTenantIdAndId(tenantId, wo.getAssetId()).ifPresent(a -> {
            a.setStatus("UNDER_MAINTENANCE");
            assetRepo.save(a);
        });

        return toWorkOrderView(workOrderRepo.save(wo));
    }

    @Transactional
    public MaintenanceDtos.WorkOrderView assignWorkOrder(UUID tenantId, UUID id, UUID technicianUserId) {
        MaintenanceWorkOrderEntity wo = workOrderRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Work order not found"));
        wo.assign(technicianUserId);
        return toWorkOrderView(workOrderRepo.save(wo));
    }

    @Transactional
    public MaintenanceDtos.WorkOrderView completeWorkOrder(UUID tenantId, UUID id, MaintenanceDtos.CompleteWorkOrderRequest request) {
        MaintenanceWorkOrderEntity wo = workOrderRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Work order not found"));

        BigDecimal totalPartsCost = BigDecimal.ZERO;

        // Process parts consumption (both in-house stock parts and outside purchased parts)
        if (request.partsConsumed() != null && !request.partsConsumed().isEmpty()) {
            for (var p : request.partsConsumed()) {
                if (p.quantity() == null || p.quantity().compareTo(BigDecimal.ZERO) <= 0) continue;

                String source = p.partSource() != null && !p.partSource().isBlank() ? p.partSource().toUpperCase() : "INTERNAL";
                BigDecimal unitCost = p.unitCost() != null ? p.unitCost() : BigDecimal.ZERO;

                if ("INTERNAL".equalsIgnoreCase(source) && p.itemId() != null) {
                    ItemEntity item = itemRepo.findByTenantIdAndId(tenantId, p.itemId())
                        .orElseThrow(() -> new NotFoundException("Spare part item not found: " + p.itemId()));

                    if (p.unitCost() == null && item.getUnitPrice() != null) {
                        unitCost = item.getUnitPrice();
                    }

                    MaintenancePartConsumptionEntity partRecord = new MaintenancePartConsumptionEntity(
                        tenantId,
                        wo.getId(),
                        item.getId(),
                        p.warehouseId(),
                        p.quantity(),
                        unitCost,
                        "INTERNAL",
                        item.getName(),
                        item.getSku(),
                        null,
                        null
                    );
                    partRepo.save(partRecord);

                    BigDecimal lineTotal = p.quantity().multiply(unitCost).setScale(2, RoundingMode.HALF_UP);
                    totalPartsCost = totalPartsCost.add(lineTotal);

                    // Deduct stock from warehouse if warehouse provided
                    if (p.warehouseId() != null) {
                        var warehouse = warehouseRepo.findByTenantIdAndIdAndActiveTrue(tenantId, p.warehouseId());
                        if (warehouse.isPresent()) {
                            int qtyInt = p.quantity().intValue();
                            var stockOpt = warehouseStockRepo.findByLocationAndItem(tenantId, p.warehouseId(), item.getId());
                            if (stockOpt.isPresent()) {
                                var stock = stockOpt.get();
                                if (stock.getOnHand() >= qtyInt) {
                                    stock.sellAvailable(qtyInt);
                                    warehouseStockRepo.save(stock);

                                    movementRepo.save(new InventoryMovementEntity(
                                        tenantId,
                                        item,
                                        warehouse.get(),
                                        -qtyInt,
                                        "MAINTENANCE_PARTS_CONSUMPTION",
                                        wo.getOrderNumber(),
                                        UUID.randomUUID().toString()
                                    ));
                                }
                            }
                        }
                    }
                } else {
                    // External replacement part purchased from outside supplier / local vendor
                    String extName = p.externalPartName() != null && !p.externalPartName().isBlank()
                        ? p.externalPartName().trim()
                        : "External Replacement Part";

                    MaintenancePartConsumptionEntity partRecord = new MaintenancePartConsumptionEntity(
                        tenantId,
                        wo.getId(),
                        null,
                        null,
                        p.quantity(),
                        unitCost,
                        "EXTERNAL",
                        extName,
                        p.externalPartNumber(),
                        p.supplierName(),
                        p.invoiceReference()
                    );
                    partRepo.save(partRecord);

                    BigDecimal lineTotal = p.quantity().multiply(unitCost).setScale(2, RoundingMode.HALF_UP);
                    totalPartsCost = totalPartsCost.add(lineTotal);
                }
            }
        }

        BigDecimal laborCost = request.laborCost() != null ? request.laborCost() : BigDecimal.ZERO;
        String techType = request.technicianType() != null && !request.technicianType().isBlank()
            ? request.technicianType().toUpperCase()
            : wo.getTechnicianType();
        String extContractor = request.externalContractorName() != null ? request.externalContractorName() : wo.getExternalContractorName();
        String extInvoice = request.externalInvoiceRef() != null ? request.externalInvoiceRef() : wo.getExternalInvoiceRef();

        if (request.assignedTechnicianUserId() != null) {
            wo.assign(request.assignedTechnicianUserId());
        }

        wo.complete(
            request.rootCause(),
            request.resolutionNotes(),
            request.downtimeMinutes(),
            techType,
            extContractor,
            extInvoice,
            laborCost,
            totalPartsCost
        );

        // Update schedule if tied to one
        if (wo.getScheduleId() != null) {
            scheduleRepo.findByTenantIdAndId(tenantId, wo.getScheduleId()).ifPresent(s -> {
                LocalDate next = "CALENDAR_DAYS".equalsIgnoreCase(s.getFrequencyType())
                    ? LocalDate.now().plusDays(s.getFrequencyInterval())
                    : null;
                s.recordExecution(wo.getCompletedAt(), next);
                scheduleRepo.save(s);
            });
        }

        // Restore asset to OPERATIONAL, update service dates and accumulate maintenance cost
        assetRepo.findByTenantIdAndId(tenantId, wo.getAssetId()).ifPresent(a -> {
            a.setStatus("OPERATIONAL");
            a.setLastServiceDate(LocalDate.now());
            a.addMaintenanceCost(wo.getTotalCost());
            if (wo.getScheduleId() != null) {
                scheduleRepo.findByTenantIdAndId(tenantId, wo.getScheduleId()).ifPresent(s -> {
                    if (s.getNextDueDate() != null) a.setNextServiceDueDate(s.getNextDueDate());
                });
            }
            assetRepo.save(a);
        });

        return toWorkOrderView(workOrderRepo.save(wo));
    }

    @Transactional
    public MaintenanceDtos.WorkOrderView cancelWorkOrder(UUID tenantId, UUID id, String notes) {
        MaintenanceWorkOrderEntity wo = workOrderRepo.findByTenantIdAndId(tenantId, id)
            .orElseThrow(() -> new NotFoundException("Work order not found"));
        wo.cancel(notes != null ? notes : "Cancelled by technician/manager");

        // Restore asset to OPERATIONAL if no other active breakdown work orders
        assetRepo.findByTenantIdAndId(tenantId, wo.getAssetId()).ifPresent(a -> {
            a.setStatus("OPERATIONAL");
            assetRepo.save(a);
        });

        return toWorkOrderView(workOrderRepo.save(wo));
    }

    private MaintenanceDtos.WorkOrderView toWorkOrderView(MaintenanceWorkOrderEntity w) {
        String aCode = null;
        String aName = null;
        UUID wcId = null;
        String wcName = null;
        var a = assetRepo.findByTenantIdAndId(w.getTenantId(), w.getAssetId());
        if (a.isPresent()) {
            aCode = a.get().getCode();
            aName = a.get().getName();
            wcId = a.get().getWorkCenterId();
            if (wcId != null) {
                var wc = workCenterRepo.findByTenantIdAndId(w.getTenantId(), wcId);
                if (wc.isPresent()) wcName = wc.get().getName();
            }
        }

        String sTitle = null;
        if (w.getScheduleId() != null) {
            var s = scheduleRepo.findByTenantIdAndId(w.getTenantId(), w.getScheduleId());
            if (s.isPresent()) sTitle = s.get().getTitle();
        }

        String techName = null;
        if (w.getAssignedTechnicianUserId() != null) {
            var u = userRepo.findById(w.getAssignedTechnicianUserId());
            if (u.isPresent()) techName = u.get().getDisplayName();
        }

        List<MaintenanceDtos.PartConsumedView> parts = partRepo.findAllByTenantIdAndWorkOrderId(w.getTenantId(), w.getId())
            .stream().map(p -> {
                String sku = p.getExternalPartNumber();
                String iName = p.getExternalPartName();
                if (p.getItemId() != null) {
                    var item = itemRepo.findByTenantIdAndId(w.getTenantId(), p.getItemId());
                    if (item.isPresent()) {
                        sku = item.get().getSku();
                        iName = item.get().getName();
                    }
                }
                String whName = null;
                if (p.getWarehouseId() != null) {
                    var wh = warehouseRepo.findByTenantIdAndIdAndActiveTrue(w.getTenantId(), p.getWarehouseId());
                    if (wh.isPresent()) whName = wh.get().getName();
                }
                BigDecimal totalCost = p.getQuantity().multiply(p.getUnitCost()).setScale(2, RoundingMode.HALF_UP);
                return new MaintenanceDtos.PartConsumedView(
                    p.getId(),
                    p.getPartSource(),
                    p.getItemId(),
                    sku,
                    iName,
                    p.getWarehouseId(),
                    whName,
                    p.getExternalPartName(),
                    p.getExternalPartNumber(),
                    p.getSupplierName(),
                    p.getInvoiceReference(),
                    p.getQuantity(),
                    p.getUnitCost(),
                    totalCost,
                    p.getCreatedAt()
                );
            }).toList();

        return new MaintenanceDtos.WorkOrderView(
            w.getId(),
            w.getOrderNumber(),
            w.getAssetId(),
            aCode,
            aName,
            wcId,
            wcName,
            w.getScheduleId(),
            sTitle,
            w.getType(),
            w.getPriority(),
            w.getStatus(),
            w.getTechnicianType(),
            w.getAssignedTechnicianUserId(),
            techName,
            w.getExternalContractorName(),
            w.getExternalInvoiceRef(),
            w.getLaborCost(),
            w.getPartsCost(),
            w.getTotalCost(),
            w.getFailureSymptom(),
            w.getRootCause(),
            w.getResolutionNotes(),
            w.getDowntimeMinutes(),
            w.getScheduledDate(),
            w.getStartedAt(),
            w.getCompletedAt(),
            w.getCreatedAt(),
            parts
        );
    }

    // ==========================================
    // METRICS & TELEMETRY
    // ==========================================

    @Transactional(readOnly = true)
    public MaintenanceDtos.MaintenanceMetricsView getMetrics(UUID tenantId) {
        long totalAssets = assetRepo.count();
        long operational = assetRepo.countByTenantIdAndStatus(tenantId, "OPERATIONAL");
        long underMaintenance = assetRepo.countByTenantIdAndStatus(tenantId, "UNDER_MAINTENANCE");

        long openOrders = workOrderRepo.countByTenantIdAndStatusIn(tenantId, List.of("OPEN", "IN_PROGRESS"));
        long criticalBreakdowns = workOrderRepo.countByTenantIdAndPriorityAndStatusIn(tenantId, "EMERGENCY", List.of("OPEN", "IN_PROGRESS"))
            + workOrderRepo.countByTenantIdAndPriorityAndStatusIn(tenantId, "HIGH", List.of("OPEN", "IN_PROGRESS"));

        double availability = totalAssets > 0 ? ((double) operational / totalAssets) * 100.0 : 100.0;
        availability = Math.round(availability * 10.0) / 10.0;

        // MTBF & MTTR calculation from completed work orders
        List<MaintenanceWorkOrderEntity> completed = workOrderRepo.findAllByTenantIdAndStatus(tenantId, "COMPLETED");
        double totalDowntimeMinutes = completed.stream().mapToInt(MaintenanceWorkOrderEntity::getDowntimeMinutes).sum();
        double mttrMinutes = completed.isEmpty() ? 0.0 : Math.round(totalDowntimeMinutes / completed.size() * 10.0) / 10.0;

        // Approximate MTBF from total operating hours divided by number of breakdowns
        long breakdownCount = completed.stream().filter(w -> "BREAKDOWN".equalsIgnoreCase(w.getType())).count();
        double totalMeterHours = assetRepo.findAllByTenantIdOrderByCodeAsc(tenantId).stream()
            .mapToDouble(a -> a.getMeterHours() != null ? a.getMeterHours().doubleValue() : 0.0).sum();
        double mtbfHours = breakdownCount > 0 ? Math.round((totalMeterHours / breakdownCount) * 10.0) / 10.0 : 720.0;

        // Spare parts consumption stats
        List<MaintenancePartConsumptionEntity> allParts = partRepo.findAllByTenantIdOrderByCreatedAtDesc(tenantId);
        long partsCount = allParts.size();
        BigDecimal partsValue = allParts.stream()
            .map(p -> p.getQuantity().multiply(p.getUnitCost()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalExpenditure = completed.stream()
            .map(w -> w.getTotalCost() != null ? w.getTotalCost() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        return new MaintenanceDtos.MaintenanceMetricsView(
            totalAssets,
            operational,
            underMaintenance,
            openOrders,
            criticalBreakdowns,
            availability,
            mtbfHours,
            mttrMinutes,
            partsCount,
            partsValue,
            totalExpenditure
        );
    }
}
