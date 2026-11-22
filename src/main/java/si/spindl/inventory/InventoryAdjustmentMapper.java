package si.spindl.inventory;

import si.spindl.inventory.InventoryAdjustmentDtos.MovementView;

/** Entity and row mapping for InventoryAdjustmentDtos. The records themselves stay free of persistence types. */
public final class InventoryAdjustmentMapper {
    private InventoryAdjustmentMapper() {}

    public static MovementView toMovementView(InventoryMovementEntity movement) {
WarehouseEntity warehouse=movement.getWarehouse();return new MovementView(movement.getId(),movement.getItem().getId(),movement.getItem().getSku(),movement.getItem().getName(),warehouse==null?null:warehouse.getId(),warehouse==null?null:warehouse.getCode(),warehouse==null?null:warehouse.getName(),movement.getQuantityDelta(),movement.getReason(),movement.getSourceReference(),movement.getCreatedAt());
    }
}
