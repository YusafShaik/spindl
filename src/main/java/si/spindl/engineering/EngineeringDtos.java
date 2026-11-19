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
    ) {
        public static EcoSummaryView from(EngineeringChangeOrderEntity e) {
            long approved = e.getSignOffs().stream().filter(s -> "APPROVED".equalsIgnoreCase(s.getStatus())).count();
            return new EcoSummaryView(
                    e.getId(),
                    e.getEcoNumber(),
                    e.getTitle(),
                    e.getReason(),
                    e.getChangeSeverity(),
                    e.getFinishedItem().getId(),
                    e.getFinishedItem().getSku(),
                    e.getFinishedItem().getName(),
                    e.getBaseBom() != null ? e.getBaseBom().getId() : null,
                    e.getBaseBom() != null ? e.getBaseBom().getRevision() : "BASELINE",
                    e.getTargetRevision(),
                    e.getStatus(),
                    e.getEffectiveCutoverDate(),
                    approved,
                    e.getSignOffs().size(),
                    e.getCreatedBy() != null ? e.getCreatedBy().getDisplayName() : "Chief Engineer",
                    e.getCreatedAt(),
                    e.getImplementedAt()
            );
        }
    }

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
    ) {
        public static EcoDiffLineView from(EcoBomDiffLineEntity d) {
            return new EcoDiffLineView(
                    d.getId(),
                    d.getChangeType(),
                    d.getComponentItem().getId(),
                    d.getComponentItem().getSku(),
                    d.getComponentItem().getName(),
                    d.getComponentItem().getUnit(),
                    d.getOldQuantity(),
                    d.getNewQuantity(),
                    d.getOldScrapPercent(),
                    d.getNewScrapPercent(),
                    d.getNotes()
            );
        }
    }

    public record EcoSignOffView(
            UUID id,
            String department,
            String status,
            String approverName,
            String signOffRole,
            String comments,
            Instant approvedAt
    ) {
        public static EcoSignOffView from(EcoSignOffEntity s) {
            return new EcoSignOffView(
                    s.getId(),
                    s.getDepartment(),
                    s.getStatus(),
                    s.getApproverUser() != null ? s.getApproverUser().getDisplayName() : null,
                    s.getSignOffRole(),
                    s.getComments(),
                    s.getApprovedAt()
            );
        }
    }

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
    ) {
        public static EcoDetailView of(EngineeringChangeOrderEntity e, List<EcoBomDiffLineEntity> diffs, List<EcoSignOffEntity> signs) {
            return new EcoDetailView(
                    e.getId(),
                    e.getEcoNumber(),
                    e.getTitle(),
                    e.getReason(),
                    e.getChangeSeverity(),
                    e.getFinishedItem().getId(),
                    e.getFinishedItem().getSku(),
                    e.getFinishedItem().getName(),
                    e.getBaseBom() != null ? e.getBaseBom().getId() : null,
                    e.getBaseBom() != null ? e.getBaseBom().getRevision() : "BASELINE",
                    e.getTargetRevision(),
                    e.getStatus(),
                    e.getEffectiveCutoverDate(),
                    e.getImplementationNotes(),
                    e.getImplementedBom() != null ? e.getImplementedBom().getId() : null,
                    e.getImplementedBom() != null ? e.getImplementedBom().getRevision() : null,
                    e.getCreatedBy() != null ? e.getCreatedBy().getDisplayName() : "Chief Engineer",
                    e.getCreatedAt(),
                    e.getImplementedAt(),
                    diffs.stream().map(EcoDiffLineView::from).toList(),
                    signs.stream().map(EcoSignOffView::from).toList()
            );
        }

        public static EcoDetailView from(EngineeringChangeOrderEntity e) {
            return of(e, e.getDiffLines(), e.getSignOffs());
        }
    }

    public record RedlineComponentLine(
            UUID itemId,
            String sku,
            String name,
            String unit,
            int quantity,
            BigDecimal scrapPercent,
            String changeStatus, // 'UNCHANGED', 'ADDED', 'REMOVED', 'MODIFIED'
            Integer previousQuantity,
            BigDecimal previousScrapPercent,
            String changeNotes
    ) {}

    public record BomRedlineComparison(
            UUID ecoId,
            String ecoNumber,
            String finishedSku,
            String finishedItemName,
            String baseRevision,
            String targetRevision,
            List<RedlineComponentLine> baselineLines,
            List<RedlineComponentLine> proposedLines,
            int addedCount,
            int removedCount,
            int modifiedCount
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
