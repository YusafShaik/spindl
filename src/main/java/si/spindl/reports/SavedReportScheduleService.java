package si.spindl.reports;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.tenant.CurrentTenant;
import java.time.*;
import java.time.temporal.TemporalAccessor;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class SavedReportScheduleService {
    private final CurrentTenant tenant;
    private final SavedReportScheduleRepository schedules;
    private final SavedReportRunRepository runs;
    private final SavedReportRepository reports;
    private final ReportBuilderService reportBuilder;
    private final TenantAuditEventRepository audit;

    public SavedReportScheduleService(CurrentTenant tenant,SavedReportScheduleRepository schedules,SavedReportRunRepository runs,SavedReportRepository reports,ReportBuilderService reportBuilder,TenantAuditEventRepository audit){this.tenant=tenant;this.schedules=schedules;this.runs=runs;this.reports=reports;this.reportBuilder=reportBuilder;this.audit=audit;}

    @Transactional(readOnly=true) public List<ScheduleView> list(){UUID tenantId=tenant.currentTenantId();return schedules.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(ScheduleView::from).toList();}
    @Transactional public ScheduleView create(UUID actor,CreateRequest request){UUID tenantId=tenant.currentTenantId();SavedReportEntity report=reports.findByTenantIdAndId(tenantId,request.reportId()).orElseThrow(()->notFound("Saved report not found"));var existing=schedules.findByTenantIdAndReportId(tenantId,report.getId());if(existing.isPresent()&&existing.get().isEnabled())throw new ConflictException("This report already has an active schedule");String frequency=request.frequency()==null?"":request.frequency().trim().toUpperCase(Locale.ROOT);if(!Set.of("DAILY","WEEKLY","MONTHLY").contains(frequency))throw badRequest("Choose daily, weekly, or monthly scheduling");ZoneId zone;try{zone=ZoneId.of(request.timezone());}catch(Exception exception){throw badRequest("Choose a valid time zone");}LocalTime runAt=request.runAt();if(runAt==null)throw badRequest("Choose a report run time");Integer weekDay=request.weekDay(),monthDay=request.monthDay();if(frequency.equals("WEEKLY")&&(weekDay==null||weekDay<1||weekDay>7||monthDay!=null))throw badRequest("Choose a weekday from 1 to 7");if(frequency.equals("MONTHLY")&&(monthDay==null||monthDay<1||monthDay>28||weekDay!=null))throw badRequest("Choose a day of the month from 1 to 28");if(frequency.equals("DAILY")&&(weekDay!=null||monthDay!=null))throw badRequest("Daily schedules do not use a day selector");Instant next=nextRun(Instant.now(),frequency,runAt,zone,weekDay,monthDay);var schedule=existing.orElseGet(()->new SavedReportScheduleEntity(tenantId,report.getId(),actor,frequency,runAt,weekDay,monthDay,zone.getId(),next));boolean wasExisting=existing.isPresent();if(wasExisting)schedule.configure(frequency,runAt,weekDay,monthDay,zone.getId(),next);schedule=schedules.save(schedule);audit.save(new TenantAuditEventEntity(tenantId,actor,wasExisting?"SAVED_REPORT_SCHEDULE_UPDATED":"SAVED_REPORT_SCHEDULE_CREATED","saved_report_schedule",schedule.getId(),Map.of("reportId",report.getId().toString(),"frequency",frequency,"timezone",zone.getId())));return ScheduleView.from(schedule);}
    @Transactional public void disable(UUID actor,UUID id){UUID tenantId=tenant.currentTenantId();var schedule=schedules.findByTenantIdAndId(tenantId,id).orElseThrow(()->notFound("Report schedule not found"));if(schedule.isEnabled()){schedule.disable();audit.save(new TenantAuditEventEntity(tenantId,actor,"SAVED_REPORT_SCHEDULE_DISABLED","saved_report_schedule",id,Map.of("reportId",schedule.getReportId().toString())));}}
    @Transactional(readOnly=true) public List<RunView> history(UUID id){UUID tenantId=tenant.currentTenantId();if(schedules.findByTenantIdAndId(tenantId,id).isEmpty())throw notFound("Report schedule not found");return runs.findAllByTenantIdAndScheduleIdOrderByCompletedAtDesc(tenantId,id,PageRequest.of(0,20)).stream().map(RunView::from).toList();}

    @Transactional public int runDue(){Instant now=Instant.now();List<SavedReportScheduleEntity> due=schedules.lockDue(now,PageRequest.of(0,20));for(var schedule:due){String reportName="Saved report";try{var report=reports.findByTenantIdAndId(schedule.getTenantId(),schedule.getReportId()).orElseThrow(()->notFound("Saved report not found"));reportName=report.getName();var result=reportBuilder.runForTenant(schedule.getTenantId(),schedule.getReportId(),null,0,100);Map<String,Object> data=new LinkedHashMap<>();data.put("dataSource",result.dataSource());data.put("columns",result.columns());data.put("totalElements",result.totalElements());List<Map<String,Object>> safeRows=result.rows().stream().map(row->{Map<String,Object> safe=new LinkedHashMap<>();row.forEach((key,value)->safe.put(key,jsonValue(value)));return safe;}).toList();data.put("rows",safeRows);runs.save(new SavedReportRunEntity(schedule.getTenantId(),schedule.getId(),reportName,"COMPLETED",data,null));audit.save(new TenantAuditEventEntity(schedule.getTenantId(),schedule.getCreatedBy(),"SAVED_REPORT_SCHEDULE_COMPLETED","saved_report_schedule",schedule.getId(),Map.of("runLimit",100,"totalElements",result.totalElements())));}catch(Exception exception){String message=exception.getMessage()==null?"Scheduled report could not be generated":exception.getMessage();runs.save(new SavedReportRunEntity(schedule.getTenantId(),schedule.getId(),reportName,"FAILED",Map.of(),message.substring(0,Math.min(500,message.length()))));audit.save(new TenantAuditEventEntity(schedule.getTenantId(),schedule.getCreatedBy(),"SAVED_REPORT_SCHEDULE_FAILED","saved_report_schedule",schedule.getId(),Map.of("message",message.substring(0,Math.min(200,message.length())))));}runs.pruneHistory(schedule.getTenantId(),schedule.getId());schedule.completed(nextRun(now,schedule.getFrequency(),schedule.getRunAt(),ZoneId.of(schedule.getTimezone()),schedule.getWeekDay(),schedule.getMonthDay()));}return due.size();}

    private Object jsonValue(Object value){if(value==null||value instanceof String||value instanceof Number||value instanceof Boolean)return value;if(value instanceof UUID||value instanceof TemporalAccessor)return value.toString();return String.valueOf(value);}

    static Instant nextRun(Instant base,String frequency,LocalTime time,ZoneId zone,Integer weekDay,Integer monthDay){ZonedDateTime now=base.atZone(zone);LocalDate date=now.toLocalDate();ZonedDateTime candidate=switch(frequency){case "DAILY"->date.atTime(time).atZone(zone);case "WEEKLY"->date.with(TemporalAdjusters.nextOrSame(DayOfWeek.of(weekDay))).atTime(time).atZone(zone);case "MONTHLY"->date.withDayOfMonth(monthDay).atTime(time).atZone(zone);default->throw new IllegalArgumentException("Unsupported schedule frequency");};if(!candidate.isAfter(now))candidate=switch(frequency){case "DAILY"->candidate.plusDays(1);case "WEEKLY"->candidate.plusWeeks(1);case "MONTHLY"->candidate.plusMonths(1);default->candidate;};return candidate.toInstant();}
    private ResponseStatusException badRequest(String message){return new BadRequestException(message);}private ResponseStatusException notFound(String message){return new NotFoundException(message);}
    public record CreateRequest(UUID reportId,String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone){}
    public record ScheduleView(UUID id,UUID reportId,String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone,boolean enabled,Instant nextRunAt,Instant lastRunAt,Instant createdAt){static ScheduleView from(SavedReportScheduleEntity s){return new ScheduleView(s.getId(),s.getReportId(),s.getFrequency(),s.getRunAt(),s.getWeekDay(),s.getMonthDay(),s.getTimezone(),s.isEnabled(),s.getNextRunAt(),s.getLastRunAt(),s.getCreatedAt());}}
    public record RunView(UUID id,String reportName,String status,Map<String,Object> result,String errorMessage,Instant completedAt){static RunView from(SavedReportRunEntity r){return new RunView(r.getId(),r.getReportName(),r.getStatus(),r.getResult(),r.getErrorMessage(),r.getCompletedAt());}}
}
