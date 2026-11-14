package si.spindl.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface FinanceActivityRow {
    UUID getId();
    String getType();
    String getReference();
    String getCounterparty();
    Instant getOccurredAt();
    BigDecimal getAmount();
    String getStatus();
    String getMethod();
    String getDirection();
}
