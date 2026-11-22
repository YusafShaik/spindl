package si.spindl.manufacturing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.time.Instant;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;

public final class ManufacturingDtos {
    private ManufacturingDtos() {}
    public record BomLineRequest(@NotNull UUID componentItemId,@Min(1) int quantityPerUnit,@NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal scrapAllowancePercent,@Size(max=40) String alternativeGroup) {}
    public record CreateBomRequest(@NotNull UUID finishedItemId,@NotBlank @Size(max=24) String revision,LocalDate effectiveFrom,LocalDate effectiveTo,@NotEmpty List<@Valid BomLineRequest> lines) {}
    public record BomLineView(UUID id,UUID componentItemId,String sku,String itemName,String unit,int quantityPerUnit,BigDecimal scrapAllowancePercent,String alternativeGroup) {}
    public record BomView(UUID id,UUID finishedItemId,String finishedSku,String finishedItemName,String revision,String status,LocalDate effectiveFrom,LocalDate effectiveTo,List<BomLineView> lines,List<BomOperationView> operations) {}
    public record UpdateBomRequest(LocalDate effectiveFrom,LocalDate effectiveTo,@NotEmpty List<@Valid BomLineRequest> lines) {}
    public record BomHistoryView(UUID id,String eventType,String previousStatus,String newStatus,UUID actorUserId,java.time.Instant createdAt) {}
    public record WorkCenterRequest(@NotBlank @Size(max=40) String code,@NotBlank @Size(max=120) String name,@Size(max=500) String description,@NotNull @DecimalMin("0.00") BigDecimal laborRatePerHour,@NotNull @DecimalMin("0.00") BigDecimal overheadRatePerHour) {}
    public record WorkCenterActiveRequest(boolean active) {}
    public record WorkCenterView(UUID id,String code,String name,String description,boolean active,BigDecimal laborRatePerHour,BigDecimal overheadRatePerHour) { public WorkCenterView withoutRates(){return new WorkCenterView(id,code,name,description,active,null,null);} }
    public record OperatorOption(UUID userId,String name,String email) {}
    public record AssignOperatorRequest(UUID operatorUserId) {}
    public record WorkCenterQueueCard(UUID id,int sequence,String name,String status,UUID operatorUserId,java.time.Instant startedAt,UUID workOrderId,String orderNumber,String workOrderStatus,String finishedSku,String finishedItemName,int targetQuantity,LocalDate dueDate,String priority) {}
    public record RoutingOperationRequest(@Min(1) int sequence,@NotBlank @Size(max=120) String name,@NotNull UUID workCenterId,@Min(0) int setupMinutes,@NotNull @DecimalMin("0.00") BigDecimal runMinutesPerUnit,@Size(max=240) String skillRequirements) {}
    public record UpdateRoutingRequest(@NotNull List<@Valid RoutingOperationRequest> operations) {}
    public record BomOperationView(UUID id,int sequence,String name,UUID workCenterId,String workCenterCode,String workCenterName,int setupMinutes,BigDecimal runMinutesPerUnit,String skillRequirements) {}
    public record MaterialAllocation(@NotNull UUID componentItemId,@NotNull UUID warehouseId) {}
    public record CreateWorkOrderRequest(@NotNull UUID bomId,@Min(1) int targetQuantity,@NotBlank @Size(max=120) String idempotencyKey,LocalDate plannedStart,LocalDate dueDate,String priority,UUID outputWarehouseId,@Size(max=500) List<@Valid MaterialAllocation> materialAllocations,@Size(max=500) List<UUID> selectedAlternateComponentIds) {}
    public record QuantityRequest(@Min(1) int quantity,@NotBlank @Size(max=120) String idempotencyKey) {}
    public record ByproductRequest(@NotNull UUID itemId,@NotNull UUID warehouseId,@Min(1) int quantity) {}
    public record OutputRequest(@Min(0) int goodQuantity,@Min(0) int scrapQuantity,@Min(0) int reworkQuantity,@Size(max=100) List<@Valid ByproductRequest> byproducts,@NotBlank @Size(max=120) String idempotencyKey) {}
    public record ReworkDispositionRequest(@Min(1) int quantity,@Min(0) int goodQuantity,@Min(0) int scrapQuantity,@NotBlank @Size(max=120) String idempotencyKey) {}
    public record MaterialView(UUID id,UUID componentItemId,String sku,String itemName,String unit,UUID warehouseId,String warehouseCode,String warehouseName,int quantityPerUnit,BigDecimal scrapAllowancePercent,int requiredQuantity,int issuedQuantity,int returnedQuantity,int availableQuantity,int shortageQuantity) {}
    public record WorkOrderView(UUID id,String orderNumber,String status,UUID bomId,String bomRevision,UUID finishedItemId,String finishedSku,String finishedItemName,UUID outputWarehouseId,String outputWarehouseName,int targetQuantity,int goodQuantity,int scrapQuantity,int reworkQuantity,LocalDate plannedStart,LocalDate dueDate,String priority,List<MaterialView> materials,List<WorkOrderOperationView> operations,BigDecimal estimatedMaterialCost,BigDecimal actualMaterialCost,BigDecimal materialCostVariance,int unpricedMaterialLines,String materialCostMethod,BigDecimal estimatedLaborCost,BigDecimal actualLaborCost,BigDecimal estimatedOverheadCost,BigDecimal actualOverheadCost) { public WorkOrderView withoutCostDetails(){return new WorkOrderView(id,orderNumber,status,bomId,bomRevision,finishedItemId,finishedSku,finishedItemName,outputWarehouseId,outputWarehouseName,targetQuantity,goodQuantity,scrapQuantity,reworkQuantity,plannedStart,dueDate,priority,materials,operations.stream().map(WorkOrderOperationView::withoutCostDetails).toList(),null,null,null,0,null,null,null,null,null);} }
    public record WorkOrderOperationView(UUID id,int sequence,String name,UUID workCenterId,String workCenterCode,String workCenterName,int setupMinutes,BigDecimal runMinutesPerUnit,String skillRequirements,String status,UUID operatorUserId,java.time.Instant startedAt,java.time.Instant completedAt,Integer actualSetupMinutes,Integer actualRunMinutes,int producedQuantity,int scrapQuantity,int reworkQuantity,int downtimeMinutes,String downtimeReason,BigDecimal laborCostAmount,BigDecimal overheadCostAmount) { public WorkOrderOperationView withoutCostDetails(){return new WorkOrderOperationView(id,sequence,name,workCenterId,workCenterCode,workCenterName,setupMinutes,runMinutesPerUnit,skillRequirements,status,operatorUserId,startedAt,completedAt,actualSetupMinutes,actualRunMinutes,producedQuantity,scrapQuantity,reworkQuantity,downtimeMinutes,downtimeReason,null,null);} }
    public record CompleteOperationRequest(@Min(0) int producedQuantity,@Min(0) int scrapQuantity,@Min(0) int reworkQuantity,@Min(0) int actualSetupMinutes,@Min(0) int actualRunMinutes,@Min(0) int downtimeMinutes,@Size(max=240) String downtimeReason,@NotBlank @Size(max=120) String idempotencyKey) {}
}
