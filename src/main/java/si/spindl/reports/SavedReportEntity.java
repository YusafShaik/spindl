package si.spindl.reports;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity @Table(name="tenant_saved_reports",uniqueConstraints=@UniqueConstraint(name="uk_tenant_saved_report_name",columnNames={"tenant_id","name"}))
public class SavedReportEntity {
    @Id @UuidGenerator private UUID id;
    @Column(name="tenant_id",nullable=false) private UUID tenantId;
    @Column(nullable=false,length=120) private String name;
    @Column(name="data_source",nullable=false,length=32) private String dataSource;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="selected_columns",nullable=false,columnDefinition="jsonb") private List<String> selectedColumns;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private List<java.util.Map<String,String>> filters=List.of();
    @Column(name="group_by",length=64) private String groupBy;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="metrics",nullable=false,columnDefinition="jsonb") private List<java.util.Map<String,String>> metrics=List.of();
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected SavedReportEntity(){}
    public SavedReportEntity(UUID tenantId,String name,String dataSource,List<String> columns,List<java.util.Map<String,String>> filters,String groupBy,List<java.util.Map<String,String>> metrics,UUID createdBy){this.tenantId=tenantId;this.name=name;this.dataSource=dataSource;this.selectedColumns=List.copyOf(columns);this.filters=List.copyOf(filters);this.groupBy=groupBy;this.metrics=List.copyOf(metrics);this.createdBy=createdBy;}
    public UUID getId(){return id;}public UUID getTenantId(){return tenantId;}public String getName(){return name;}public String getDataSource(){return dataSource;}public List<String> getSelectedColumns(){return selectedColumns;}public List<java.util.Map<String,String>> getFilters(){return filters;}public String getGroupBy(){return groupBy;}public List<java.util.Map<String,String>> getMetrics(){return metrics;}public UUID getCreatedBy(){return createdBy;}public Instant getCreatedAt(){return createdAt;}public Instant getUpdatedAt(){return updatedAt;}
}
