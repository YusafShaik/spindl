package si.spindl.common.event;

import java.util.Map;
import java.util.UUID;

public record DomainAuditEvent(
        UUID tenantId,
        UUID actorId,
        String eventType,
        String subjectType,
        UUID subjectId,
        Map<String, ?> details
) {
    public DomainAuditEvent(UUID tenantId, UUID actorId, String eventType, String subjectType, UUID subjectId) {
        this(tenantId, actorId, eventType, subjectType, subjectId, Map.of());
    }
}
