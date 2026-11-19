package si.spindl.catalog;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class WarehouseStockEntityTest {

    @Test
    void adjustStockIncreasesOnHand() {
        UUID tenantId = UUID.randomUUID();
        WarehouseEntity warehouse = new WarehouseEntity(tenantId, "MAIN", "Main Warehouse", UUID.randomUUID());
        ItemEntity item = new ItemEntity(tenantId, "SKU-1", "Test Item", "Parts", 0, "PCS", BigDecimal.TEN, 5);
        WarehouseStockEntity stock = new WarehouseStockEntity(tenantId, warehouse, item);

        assertEquals(0, stock.getOnHand());
        stock.adjustStock(15);
        assertEquals(15, stock.getOnHand());

        stock.adjustStock(-5);
        assertEquals(10, stock.getOnHand());
    }

    @Test
    void adjustStockFailsWhenExceedingAvailable() {
        UUID tenantId = UUID.randomUUID();
        WarehouseEntity warehouse = new WarehouseEntity(tenantId, "MAIN", "Main Warehouse", UUID.randomUUID());
        ItemEntity item = new ItemEntity(tenantId, "SKU-1", "Test Item", "Parts", 0, "PCS", BigDecimal.TEN, 5);
        WarehouseStockEntity stock = new WarehouseStockEntity(tenantId, warehouse, item);

        stock.adjustStock(10);
        stock.reserve(6);

        // Available is 10 - 6 = 4. Trying to reduce by 5 should throw.
        assertThrows(IllegalArgumentException.class, () -> stock.adjustStock(-5));
        assertEquals(10, stock.getOnHand());
    }

    @Test
    void rejectQualityHoldDecrementsOnHandAndHold() {
        UUID tenantId = UUID.randomUUID();
        WarehouseEntity warehouse = new WarehouseEntity(tenantId, "MAIN", "Main Warehouse", UUID.randomUUID());
        ItemEntity item = new ItemEntity(tenantId, "SKU-1", "Test Item", "Parts", 0, "PCS", BigDecimal.TEN, 5);
        WarehouseStockEntity stock = new WarehouseStockEntity(tenantId, warehouse, item);

        stock.receiveStock(20);
        stock.addQualityHold(15);
        assertEquals(20, stock.getOnHand());
        assertEquals(15, stock.getQualityHoldQuantity());

        stock.rejectQualityHold(10);
        assertEquals(10, stock.getOnHand());
        assertEquals(5, stock.getQualityHoldQuantity());
    }
}
