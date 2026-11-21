package si.spindl.dashboard;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;
    private final DevelopmentTenant tenant;

    @GetMapping("/summary")
    public Summary summary() {
        return dashboardService.getSummary(tenant.currentTenantId());
    }

    @GetMapping("/trend")
    public List<TrendPoint> trend(@RequestParam(defaultValue = "6") int months) {
        return dashboardService.getTrend(tenant.currentTenantId(), months);
    }

    @GetMapping("/alerts")
    public Alerts alerts() {
        return dashboardService.getAlerts(tenant.currentTenantId());
    }

    public record Summary(BigDecimal salesThisMonth, int openOrders, BigDecimal inventoryValue, long activeCustomers,
                          int lowStockItems, BigDecimal accountsReceivable, BigDecimal overdueReceivables,
                          BigDecimal accountsPayable, BigDecimal overduePayables) {}

    public record TrendPoint(String period, String label, BigDecimal sales, BigDecimal purchases) {}

    public record Alerts(List<LowStockItem> lowStockItems) {}

    public record LowStockItem(UUID itemId, String sku, String name, int onHand, int reserved, int available,
                               int threshold, String unit) {}
}
