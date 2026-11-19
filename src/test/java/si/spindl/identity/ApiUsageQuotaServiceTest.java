package si.spindl.identity;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class ApiUsageQuotaServiceTest {

    @Test
    void buffersUsageWithoutImmediateDbLock() {
        TenantSubscriptionRepository subscriptions = Mockito.mock(TenantSubscriptionRepository.class);
        SubscriptionPlanRepository plans = Mockito.mock(SubscriptionPlanRepository.class);
        TenantApiUsageRepository usage = Mockito.mock(TenantApiUsageRepository.class);

        UUID tenantId = UUID.randomUUID();
        TenantSubscriptionEntity sub = new TenantSubscriptionEntity(tenantId, "PRO", 1, "ACTIVE");
        SubscriptionPlanEntity plan = Mockito.mock(SubscriptionPlanEntity.class);
        when(plan.getApiCallsPerMonth()).thenReturn(100000L);

        when(subscriptions.findByTenantId(tenantId)).thenReturn(Optional.of(sub));
        when(plans.findByPlanCodeAndVersionAndActiveTrue("PRO", 1)).thenReturn(Optional.of(plan));
        when(usage.countForMonth(eq(tenantId), any(LocalDate.class))).thenReturn(50L);

        ApiUsageQuotaService quotaService = new ApiUsageQuotaService(subscriptions, plans, usage);

        // Multiple rapid requests should succeed without throwing
        for (int i = 0; i < 20; i++) {
            assertDoesNotThrow(() -> quotaService.recordAuthenticatedRequest(tenantId));
        }

        // Flush all pending calls
        quotaService.flushAll();
        Mockito.verify(usage, Mockito.atLeastOnce()).addBatchUsage(eq(tenantId), any(LocalDate.class), Mockito.anyLong());
    }
}
