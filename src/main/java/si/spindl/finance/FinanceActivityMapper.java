package si.spindl.finance;

import si.spindl.finance.FinanceActivityDtos.ActivityView;

/** Entity and row mapping for FinanceActivityDtos. The records themselves stay free of persistence types. */
public final class FinanceActivityMapper {
    private FinanceActivityMapper() {}

    public static ActivityView toActivityView(FinanceActivityRow row) {
return new ActivityView(row.getId(),row.getType(),row.getReference(),row.getCounterparty(),row.getOccurredAt(),row.getAmount(),row.getStatus(),row.getMethod(),row.getDirection());
    }
}
