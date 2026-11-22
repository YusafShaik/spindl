package si.spindl.finance;

import java.math.BigDecimal;
import java.time.LocalDate;

/** API contract for OperationalReportService. Mapping to entities lives in the mapper, not here. */
public final class OperationalReportDtos {
    private OperationalReportDtos() {}

    public record AgingRow(String reference,String counterparty,LocalDate dueDate,BigDecimal originalAmount,BigDecimal paidOrCredited,BigDecimal balance,String ageBucket) {}
}
