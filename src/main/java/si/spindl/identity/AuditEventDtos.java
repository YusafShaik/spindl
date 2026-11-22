package si.spindl.identity;

import java.time.Instant;
import java.util.UUID;
import java.util.List;
import java.util.Map;

/** API contract for AuditEventService. Mapping to entities lives in the mapper, not here. */
public final class AuditEventDtos {
    private AuditEventDtos() {}

    public record EventView(UUID id,UUID actorUserId,String actorName,String actorEmail,String eventType,String subjectType,UUID subjectId,Map<String,Object> details,Instant createdAt) {}

    public record EventPage(List<EventView> items,int page,int pageSize,long totalElements,int totalPages) {}
}
