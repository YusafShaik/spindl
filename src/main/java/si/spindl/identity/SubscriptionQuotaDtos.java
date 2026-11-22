package si.spindl.identity;

import java.util.List;

/** API contract for SubscriptionQuotaService. Mapping to entities lives in the mapper, not here. */
public final class SubscriptionQuotaDtos {
    private SubscriptionQuotaDtos() {}

    public record PlanSummary(String planCode,int version,String displayName,String status,int seatLimit,long activeSeats,long pendingInvitations,
                              int storageLimitMb,long storageUsedBytes,long apiCallsPerMonth,long apiCallsUsed) {}

    public record PlanChangePreview(String currentPlanCode,int currentVersion,String targetPlanCode,int targetVersion,String targetPlanName,
                                    int targetSeatLimit,long seatsInUse,int storageLimitMb,long storageUsedBytes,long apiCallsPerMonth,long apiCallsUsed,List<String> overages,List<String> blockedModules,
                                    String effectiveDate,String message) {}
}
