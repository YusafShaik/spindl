package si.spindl.party;
import java.util.UUID;

/** API contract for CustomerMergeService. Mapping to entities lives in the mapper, not here. */
public final class CustomerMergeDtos {
    private CustomerMergeDtos() {}

    public record MergeResult(UUID archivedCustomerId, UUID survivingCustomerId, int quotesMoved, int ordersMoved,
                              int invoicesMoved, int leadsReassigned, int customFieldsMoved, int attachmentsMoved) {}
}
