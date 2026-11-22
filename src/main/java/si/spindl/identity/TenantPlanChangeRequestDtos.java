package si.spindl.identity;

import java.time.LocalDate;
import java.util.UUID;
import java.time.Instant;

/** API contract for TenantPlanChangeRequestService. Mapping to entities lives in the mapper, not here. */
public final class TenantPlanChangeRequestDtos {
    private TenantPlanChangeRequestDtos() {}

    public record CreateRequest(String planCode) {}

    public record RequestView(UUID id,String currentPlanCode,int currentPlanVersion,String targetPlanCode,int targetPlanVersion,LocalDate effectiveDate,String status,java.time.Instant requestedAt,java.time.Instant reviewedAt,String reviewNote,java.time.Instant appliedAt) {}

    public record PlatformRequestView(UUID id,UUID tenantId,String tenantName,UUID requestedBy,String currentPlanCode,int currentPlanVersion,String targetPlanCode,int targetPlanVersion,LocalDate effectiveDate,String status,java.time.Instant requestedAt,UUID reviewedBy,java.time.Instant reviewedAt,String reviewNote,java.time.Instant appliedAt) {}
}
