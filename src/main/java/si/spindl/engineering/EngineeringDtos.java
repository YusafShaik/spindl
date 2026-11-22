package si.spindl.engineering;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class EngineeringDtos {
    private EngineeringDtos() {}

    public record EcoSummaryView(
            UUID id,
            String ecoNumber,
            String title,
            String reason,
            String changeSeverity,
            UUID finishedItemId,
            String finishedSku,
            String finishedItemName,
            UUID baseBomId,
            String baseRevision,
            String targetRevision,
            String status,
            LocalDate effectiveCutoverDate,
            long signOffsCompleted,
            long totalSignOffs,
            String createdByName,
            Instant createdAt,
            Instant implementedAt
    ) {}

    public record EcoDiffLineView(
            UUID id,
            String changeType,
            UUID componentItemId,
            String componentSku,
            String componentName,
            String componentUnit,
            int oldQuantity,
            int newQuantity,
            BigDecimal oldScrapPercent,
            BigDecimal newScrapPercent,
            String notes
    ) {}

    public record EcoSignOffView(
            UUID id,
            String department,
            String status,
            String approverName,
            String signOffRole,
            String comments,
            Instant approvedAt
    ) {}

    public record EcoDetailView(
            UUID id,
            String ecoNumber,
            String title,
            String reason,
            String changeSeverity,
            UUID finishedItemId,
            String finishedSku,
            String finishedItemName,
            UUID baseBomId,
            String baseRevision,
            String targetRevision,
            String status,
            LocalDate effectiveCutoverDate,
            String implementationNotes,
            UUID implementedBomId,
            String implementedBomRevision,
            String createdByName,
            Instant createdAt,
            Instant implementedAt,
            List<EcoDiffLineView> diffLines,
            List<EcoSignOffView> signOffs
    ) {}

    public record EngineeringMetricsView(
            long activeEcos,
            long pendingSignOffs,
            long approvedPendingCutover,
            long implementedRevisions,
            long criticalSeverityCount
    ) {}

    public record CreateDiffLineRequest(
            @NotBlank String changeType, // 'ADD', 'REMOVE', 'QUANTITY_CHANGE'
            @NotNull UUID componentItemId,
            int oldQuantity,
            int newQuantity,
            BigDecimal oldScrapPercent,
            BigDecimal newScrapPercent,
            @Size(max = 255) String notes
    ) {}

    public record CreateEcoRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank String reason,
            String changeSeverity, // 'CRITICAL', 'MAJOR', 'MINOR'
            @NotNull UUID finishedItemId,
            UUID baseBomId,
            @NotBlank @Size(max = 24) String targetRevision,
            @NotNull LocalDate effectiveCutoverDate,
            @NotEmpty List<@Valid CreateDiffLineRequest> diffLines
    ) {}

    public record SignOffRequest(
            @NotBlank String department, // 'ENGINEERING', 'MANUFACTURING', 'QUALITY', 'FINANCE'
            @NotBlank String action, // 'APPROVE', 'REJECT'
            String signOffRole,
            @Size(max = 1000) String comments
    ) {}

    public record ImplementEcoRequest(
            String implementationNotes
    ) {}
}
