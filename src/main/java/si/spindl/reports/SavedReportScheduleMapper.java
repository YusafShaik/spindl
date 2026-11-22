package si.spindl.reports;

import si.spindl.reports.SavedReportScheduleDtos.RunView;
import si.spindl.reports.SavedReportScheduleDtos.ScheduleView;

/** Entity and row mapping for SavedReportScheduleDtos. The records themselves stay free of persistence types. */
public final class SavedReportScheduleMapper {
    private SavedReportScheduleMapper() {}

    public static RunView toRunView(SavedReportRunEntity r) {
return new RunView(r.getId(),r.getReportName(),r.getStatus(),r.getResult(),r.getErrorMessage(),r.getCompletedAt());
    }

    public static ScheduleView toScheduleView(SavedReportScheduleEntity s) {
return new ScheduleView(s.getId(),s.getReportId(),s.getFrequency(),s.getRunAt(),s.getWeekDay(),s.getMonthDay(),s.getTimezone(),s.isEnabled(),s.getNextRunAt(),s.getLastRunAt(),s.getCreatedAt());
    }
}
