package si.spindl.imports;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.time.Instant;

/** API contract for CsvImportService. Mapping to entities lives in the mapper, not here. */
public final class CsvImportDtos {
    private CsvImportDtos() {}

    public record ImportError(int row,String message) {}

    public record PreviewResult(int totalRows,int validRows,List<ImportError> errors,List<Map<String,String>> sampleRows) {}

    public record BatchView(UUID id,String resourceType,String contentSha256,int rowsImported,java.time.Instant createdAt) {}

    public record CommitResult(boolean imported,boolean replayed,String resourceType,int rowsImported,UUID batchId,java.time.Instant createdAt,List<ImportError> errors) {}
}
