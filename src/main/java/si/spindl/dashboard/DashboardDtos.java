package si.spindl.dashboard;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Dashboard API contract. */
public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record Summary(BigDecimal salesThisMonth, int openOrders, BigDecimal inventoryValue, long activeCustomers,
                          int lowStockItems, BigDecimal accountsReceivable, BigDecimal overdueReceivables,
                          BigDecimal accountsPayable, BigDecimal overduePayables) {}

    public record TrendPoint(String period, String label, BigDecimal sales, BigDecimal purchases) {}

    public record Alerts(List<LowStockItem> lowStockItems) {}

    public record LowStockItem(UUID itemId, String sku, String name, int onHand, int reserved, int available,
                               int threshold, String unit) {}
}
