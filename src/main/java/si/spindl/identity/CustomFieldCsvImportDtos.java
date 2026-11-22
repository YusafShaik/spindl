package si.spindl.identity;

import java.util.List;
import java.util.Map;

/** API contract for CustomFieldCsvImportService. Mapping to entities lives in the mapper, not here. */
public final class CustomFieldCsvImportDtos {
    private CustomFieldCsvImportDtos() {}

    public record RowError(int row,String message) {}

    public record Preview(int totalRows,int validRows,List<RowError> errors,List<Map<String,String>> sampleRows,int customFieldCount) {}

    public record CommitResult(boolean imported,boolean replayed,int rowsImported,List<RowError> errors) {}
}
