package si.spindl.mrp;

import si.spindl.mrp.MrpDtos.MrpRunView;
import si.spindl.mrp.MrpDtos.PlannedOrderView;

/** Entity and row mapping for MrpDtos. The records themselves stay free of persistence types. */
public final class MrpMapper {
    private MrpMapper() {}

    public static PlannedOrderView toPlannedOrderView(MrpPlannedOrderEntity o) {

            return new PlannedOrderView(
                    o.getId(),
                    o.getMrpRun().getId(),
                    o.getMrpRun().getRunNumber(),
                    o.getItem().getId(),
                    o.getItem().getSku(),
                    o.getItem().getName(),
                    o.getItem().getUnit(),
                    o.getItem().getItemType(),
                    o.getActionType(),
                    o.getBom() != null ? o.getBom().getId() : null,
                    o.getBom() != null ? o.getBom().getRevision() : null,
                    o.getSuggestedSupplier() != null ? o.getSuggestedSupplier().getId() : null,
                    o.getSuggestedSupplier() != null ? o.getSuggestedSupplier().getName() : null,
                    o.getRecommendedQuantity(),
                    o.getRecommendedOrderDate(),
                    o.getRequiredByDate(),
                    o.getLeadTimeDays(),
                    o.getEstimatedUnitCost(),
                    o.getEstimatedTotalCost(),
                    o.getUrgency(),
                    o.getDemandSourceType(),
                    o.getDemandSourceRef(),
                    o.getStatus(),
                    o.getConvertedEntityId(),
                    o.getConvertedOrderNumber(),
                    o.getConvertedAt(),
                    o.getCreatedAt()
            );
        
    }

    public static MrpRunView toMrpRunView(MrpRunEntity r) {

            return new MrpRunView(
                    r.getId(),
                    r.getRunNumber(),
                    r.getStatus(),
                    r.getPlanningHorizonWeeks(),
                    r.getTotalRecommendations(),
                    r.getTotalPlannedSpend(),
                    r.getTotalShortageUnits(),
                    r.getNotes(),
                    r.getCreatedBy() != null ? r.getCreatedBy().getDisplayName() : "System Automation",
                    r.getCreatedAt()
            );
        
    }
}
