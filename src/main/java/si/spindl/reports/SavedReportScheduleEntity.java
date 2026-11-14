package si.spindl.reports;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity @Table(name="tenant_saved_report_schedules")
public class SavedReportScheduleEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="report_id",nullable=false) private UUID reportId;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @Column(nullable=false,length=12) private String frequency;
    @Column(name="run_at",nullable=false) private LocalTime runAt;
    @Column(name="week_day") private Short weekDay;
    @Column(name="month_day") private Short monthDay;
    @Column(nullable=false,length=64) private String timezone;
    @Column(nullable=false) private boolean enabled=true;
    @Column(name="next_run_at",nullable=false) private Instant nextRunAt;
    @Column(name="last_run_at") private Instant lastRunAt;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected SavedReportScheduleEntity(){}
    public SavedReportScheduleEntity(UUID tenantId,UUID reportId,UUID createdBy,String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone,Instant nextRunAt){this.tenantId=tenantId;this.reportId=reportId;this.createdBy=createdBy;this.frequency=frequency;this.runAt=runAt;this.weekDay=weekDay==null?null:weekDay.shortValue();this.monthDay=monthDay==null?null:monthDay.shortValue();this.timezone=timezone;this.nextRunAt=nextRunAt;}
    public void disable(){enabled=false;}
    public void configure(String frequency,LocalTime runAt,Integer weekDay,Integer monthDay,String timezone,Instant nextRunAt){this.frequency=frequency;this.runAt=runAt;this.weekDay=weekDay==null?null:weekDay.shortValue();this.monthDay=monthDay==null?null:monthDay.shortValue();this.timezone=timezone;this.nextRunAt=nextRunAt;this.enabled=true;}
    public void completed(Instant next){lastRunAt=Instant.now();nextRunAt=next;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getReportId(){return reportId;}public UUID getCreatedBy(){return createdBy;}public String getFrequency(){return frequency;}public LocalTime getRunAt(){return runAt;}public Integer getWeekDay(){return weekDay==null?null:weekDay.intValue();}public Integer getMonthDay(){return monthDay==null?null:monthDay.intValue();}public String getTimezone(){return timezone;}public boolean isEnabled(){return enabled;}public Instant getNextRunAt(){return nextRunAt;}public Instant getLastRunAt(){return lastRunAt;}public Instant getCreatedAt(){return createdAt;}
}
