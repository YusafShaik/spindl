package si.spindl.reports;

import si.spindl.reports.ReportBuilderDtos.ReportView;

/** Entity and row mapping for ReportBuilderDtos. The records themselves stay free of persistence types. */
public final class ReportBuilderMapper {
    private ReportBuilderMapper() {}

    public static ReportView toReportView(SavedReportEntity report) {
return new ReportView(report.getId(),report.getName(),report.getDataSource(),report.getSelectedColumns(),report.getFilters(),report.getGroupBy(),report.getMetrics(),report.getCreatedAt(),report.getUpdatedAt());
    }
}
