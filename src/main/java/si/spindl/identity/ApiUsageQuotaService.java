package si.spindl.identity;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class ApiUsageQuotaService {
    private final TenantSubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final TenantApiUsageRepository usage;

    public ApiUsageQuotaService(TenantSubscriptionRepository subscriptions,SubscriptionPlanRepository plans,TenantApiUsageRepository usage){
        this.subscriptions=subscriptions;this.plans=plans;this.usage=usage;
    }

    public void recordAuthenticatedRequest(UUID tenantId){
        var subscription=subscriptions.findByTenantId(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Workspace plan has not been provisioned"));
        var plan=plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(),subscription.getPlanVersion())
                .orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Workspace plan version is unavailable"));
        LocalDate month=LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        if(!usage.recordIfBelowLimit(tenantId,month,plan.getApiCallsPerMonth()))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"This workspace has reached its monthly API request allowance. Review the plan and usage in Settings.");
    }

    public long currentMonthUsage(UUID tenantId){return usage.countForMonth(tenantId,LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1));}
}
