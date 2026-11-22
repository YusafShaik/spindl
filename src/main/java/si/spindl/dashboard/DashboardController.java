package si.spindl.dashboard;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.tenant.CurrentTenant;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;
    private final CurrentTenant tenant;

    @GetMapping("/summary")
    public DashboardDtos.Summary summary() {
        return dashboardService.getSummary(tenant.currentTenantId());
    }

    @GetMapping("/trend")
    public List<DashboardDtos.TrendPoint> trend(@RequestParam(defaultValue = "6") int months) {
        return dashboardService.getTrend(tenant.currentTenantId(), months);
    }

    @GetMapping("/alerts")
    public DashboardDtos.Alerts alerts() {
        return dashboardService.getAlerts(tenant.currentTenantId());
    }
}
