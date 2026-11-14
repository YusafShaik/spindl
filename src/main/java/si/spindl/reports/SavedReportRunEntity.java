package si.spindl.reports;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity @Table(name="tenant_saved_report_runs")
public class SavedReportRunEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(name="schedule_id",nullable=false) private UUID scheduleId;
    @Column(name="report_name",nullable=false,length=120) private String reportName;
    @Column(nullable=false,length=12) private String status;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private Map<String,Object> result;
    @Column(name="error_message",length=500) private String errorMessage;
    @CreationTimestamp @Column(name="completed_at",nullable=false,updatable=false) private Instant completedAt;
    protected SavedReportRunEntity(){}
    public SavedReportRunEntity(UUID tenantId,UUID scheduleId,String reportName,String status,Map<String,Object> result,String errorMessage){this.tenantId=tenantId;this.scheduleId=scheduleId;this.reportName=reportName;this.status=status;this.result=Map.copyOf(result);this.errorMessage=errorMessage;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public UUID getScheduleId(){return scheduleId;}public String getReportName(){return reportName;}public String getStatus(){return status;}public Map<String,Object> getResult(){return result;}public String getErrorMessage(){return errorMessage;}public Instant getCompletedAt(){return completedAt;}
}
