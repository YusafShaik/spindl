package si.spindl.reports;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.time.Instant;

/** API contract for ReportBuilderService. Mapping to entities lives in the mapper, not here. */
public final class ReportBuilderDtos {
    private ReportBuilderDtos() {}

    public record CreateRequest(String name,String dataSource,List<String> columns,List<ReportFilter> filters,String groupBy,List<ReportMetricInput> metrics) {}

    public record ReportMetricInput(String function,String field) {}

    public record ReportFilter(String field,String operator,String value) {}

    public record ColumnView(String key,String label,String type) {}

    public record SourceView(String key,String label,List<ColumnView> columns) {}

    public record ReportView(UUID id,String name,String dataSource,List<String> columns,List<Map<String,String>> filters,String groupBy,List<Map<String,String>> metrics,java.time.Instant createdAt,java.time.Instant updatedAt) {}

    public record RunResult(String name,String dataSource,List<String> columns,long totalElements,int page,int pageSize,List<Map<String,Object>> rows) {}
}
