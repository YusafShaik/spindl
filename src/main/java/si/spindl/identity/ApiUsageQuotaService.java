package si.spindl.identity;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ApiUsageQuotaService {
    private final TenantSubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final TenantApiUsageRepository usage;
    private final ConcurrentHashMap<UUID, AtomicLong> pendingUsage = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Long> cachedLimits = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Long> cachedTotals = new ConcurrentHashMap<>();

    public ApiUsageQuotaService(TenantSubscriptionRepository subscriptions,SubscriptionPlanRepository plans,TenantApiUsageRepository usage){
        this.subscriptions=subscriptions;this.plans=plans;this.usage=usage;
    }

    public void recordAuthenticatedRequest(UUID tenantId){
        long limit = cachedLimits.computeIfAbsent(tenantId, id -> {
            var subscription = subscriptions.findByTenantId(id).orElse(null);
            if (subscription == null) return 100000L;
            return plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(), subscription.getPlanVersion())
                    .map(SubscriptionPlanEntity::getApiCallsPerMonth).orElse(100000L);
        });
        AtomicLong counter = pendingUsage.computeIfAbsent(tenantId, k -> new AtomicLong());
        long currentPending = counter.incrementAndGet();
        long totalEstimate = cachedTotals.getOrDefault(tenantId, 0L) + currentPending;
        if (totalEstimate >= limit) {
            flushTenant(tenantId);
            long refreshed = currentMonthUsage(tenantId);
            cachedTotals.put(tenantId, refreshed);
            if (refreshed >= limit) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"This workspace has reached its monthly API request allowance. Review the plan and usage in Settings.");
            }
        } else if (currentPending >= 50) {
            flushTenant(tenantId);
        }
    }

    @Scheduled(fixedDelay = 5000)
    public void flushAll() {
        for (UUID tenantId : pendingUsage.keySet()) {
            flushTenant(tenantId);
        }
    }

    private void flushTenant(UUID tenantId) {
        AtomicLong counter = pendingUsage.get(tenantId);
        if (counter == null) return;
        long delta = counter.getAndSet(0);
        if (delta > 0) {
            LocalDate month = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
            try {
                usage.addBatchUsage(tenantId, month, delta);
                cachedTotals.put(tenantId, usage.countForMonth(tenantId, month));
            } catch (Exception e) {
                counter.addAndGet(delta);
            }
        }
    }

    public long currentMonthUsage(UUID tenantId){return usage.countForMonth(tenantId,LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1));}
}
