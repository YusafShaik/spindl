package si.spindl.reports;
import java.util.UUID;
import java.util.Map;
import java.time.Instant;
import java.time.LocalTime;

/** API contract for SavedReportScheduleService. Mapping to entities lives in the mapper, not here. */
public final class SavedReportScheduleDtos {
    private SavedReportScheduleDtos() {}

    public record CreateRequest(UUID reportId,String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone) {}

    public record ScheduleView(UUID id,UUID reportId,String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone,boolean enabled,Instant nextRunAt,Instant lastRunAt,Instant createdAt) {}

    public record RunView(UUID id,String reportName,String status,Map<String,Object> result,String errorMessage,Instant completedAt) {}
}
