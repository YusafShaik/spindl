package si.spindl.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** API contract for PlatformSupportAccessService. Mapping to entities lives in the mapper, not here. */
public final class PlatformSupportAccessDtos {
    private PlatformSupportAccessDtos() {}

    public record CreateRequest(UUID tenantId,String reason,int durationMinutes) {}

    public record ReviewRequest(String note) {}

    public record SupportRequestView(UUID id,UUID tenantId,String tenantName,UUID requestedBy,String requesterEmail,String reason,int durationMinutes,String status,Instant expiresAt,UUID reviewedBy,Instant reviewedAt,String reviewNote,Instant createdAt) {}

    public record ModuleDiagnostic(String code,boolean entitled,boolean enabled) {}

    public record Diagnostics(UUID consentRequestId,UUID tenantId,String workspace,String accountStatus,String timezone,String countryCode,String currencyCode,String planCode,int planVersion,String subscriptionStatus,long activeSeats,long pendingInvitations,int seatLimit,long storageUsedBytes,int storageLimitMb,long apiCallsUsed,long apiCallsLimit,Instant consentExpiresAt,List<ModuleDiagnostic> modules) {}
}
