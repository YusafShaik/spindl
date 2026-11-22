package si.spindl.finance;

import java.math.BigDecimal;
import java.util.UUID;
import java.time.Instant;

/** API contract for FinanceActivityService. Mapping to entities lives in the mapper, not here. */
public final class FinanceActivityDtos {
    private FinanceActivityDtos() {}

    public record ActivityView(UUID id,String type,String reference,String counterparty,java.time.Instant occurredAt,BigDecimal amount,String status,String method,String direction) {}
}
