package si.spindl.reports;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SavedReportScheduler {
    private final SavedReportScheduleService schedules;
    public SavedReportScheduler(SavedReportScheduleService schedules){this.schedules=schedules;}
    @Scheduled(fixedDelayString="${spindl.reports.schedule-poll-ms:60000}")
    public void runDueReports(){schedules.runDue();}
}
