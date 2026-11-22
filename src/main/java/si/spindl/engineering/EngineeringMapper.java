package si.spindl.engineering;

import java.util.List;
import si.spindl.engineering.EngineeringDtos.EcoDetailView;
import si.spindl.engineering.EngineeringDtos.EcoDiffLineView;
import si.spindl.engineering.EngineeringDtos.EcoSignOffView;
import si.spindl.engineering.EngineeringDtos.EcoSummaryView;

/** Entity and row mapping for EngineeringDtos. The records themselves stay free of persistence types. */
public final class EngineeringMapper {
    private EngineeringMapper() {}

    public static EcoDetailView toEcoDetailView(EngineeringChangeOrderEntity e, List<EcoBomDiffLineEntity> diffs, List<EcoSignOffEntity> signs) {

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
                    diffs.stream().map(EngineeringMapper::toEcoDiffLineView).toList(),
                    signs.stream().map(EngineeringMapper::toEcoSignOffView).toList()
            );
        
    }

    public static EcoDetailView toEcoDetailView(EngineeringChangeOrderEntity e) {

            return toEcoDetailView(e, e.getDiffLines(), e.getSignOffs());
        
    }

    public static EcoSignOffView toEcoSignOffView(EcoSignOffEntity s) {

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

    public static EcoDiffLineView toEcoDiffLineView(EcoBomDiffLineEntity d) {

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

    public static EcoSummaryView toEcoSummaryView(EngineeringChangeOrderEntity e) {

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
