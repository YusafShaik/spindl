package si.spindl.crm;

import java.util.List;

/** Maps CRM leads and activities onto API records. */
public final class LeadMapper {

    private LeadMapper() {}

    public static LeadDtos.ActivityView toActivity(LeadActivityEntity activity) {
        return new LeadDtos.ActivityView(
                activity.getId(),
                activity.getActivityType(),
                activity.getBody(),
                activity.getDueAt(),
                activity.getCompletedAt(),
                activity.getCreatedAt(),
                activity.getActorUserId()
        );
    }

    public static LeadDtos.LeadView toLead(LeadEntity lead, List<LeadDtos.ActivityView> activities) {
        return new LeadDtos.LeadView(
                lead.getId(),
                lead.getName(),
                lead.getCompany(),
                lead.getEmail(),
                lead.getPhone(),
                lead.getSource(),
                lead.getStage(),
                lead.getOwnerUserId(),
                lead.getBranchId(),
                lead.getExpectedValue(),
                lead.getNextActivityTitle(),
                lead.getNextActivityAt(),
                lead.getConvertedCustomerId(),
                lead.getCreatedAt(),
                lead.getUpdatedAt(),
                activities
        );
    }
}
