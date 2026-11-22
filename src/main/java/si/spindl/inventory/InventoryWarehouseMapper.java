package si.spindl.inventory;

import java.util.Locale;
import java.util.UUID;
import si.spindl.inventory.InventoryWarehouseDtos.TransferView;
import si.spindl.inventory.InventoryWarehouseDtos.WarehouseView;

/** Entity and row mapping for InventoryWarehouseDtos. The records themselves stay free of persistence types. */
public final class InventoryWarehouseMapper {
    private InventoryWarehouseMapper() {}

    public static TransferView toTransferView(InventoryTransferEntity transfer) {
String reference="TRF-"+UUID.nameUUIDFromBytes(transfer.getIdempotencyKey().getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString().substring(0,12).toUpperCase(Locale.ROOT);return new TransferView(transfer.getId(),transfer.getItem().getSku(),transfer.getItem().getName(),transfer.getQuantity(),transfer.getSourceWarehouse().getCode(),transfer.getSourceWarehouse().getName(),transfer.getDestinationWarehouse().getCode(),transfer.getDestinationWarehouse().getName(),transfer.getReason(),reference,transfer.getStatus(),transfer.getApprovedBy(),transfer.getCreatedAt(),transfer.getApprovedAt(),transfer.getDispatchedAt(),transfer.getReceivedAt());
    }

    public static WarehouseView toWarehouseView(WarehouseEntity warehouse) {
return new WarehouseView(warehouse.getId(),warehouse.getCode(),warehouse.getName(),warehouse.isDefault(),warehouse.getBranchId());
    }
}
