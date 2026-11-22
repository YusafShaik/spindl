package si.spindl.finance;

import java.math.BigDecimal;
import java.util.List;

/** API contract for MarginReportService. Mapping to entities lives in the mapper, not here. */
public final class MarginReportDtos {
    private MarginReportDtos() {}

    public record MarginRow(String period, String sku, String itemName, int netUnits, BigDecimal netSales,
                            BigDecimal estimatedCostOfGoods, BigDecimal estimatedGrossMargin,
                            BigDecimal marginPercent) {}

    public record MarginReport(List<MarginRow> rows, int unpricedItemCount, BigDecimal unpricedSales,
                               String costMethodNote) {}

    public record ValuationRow(String sku, String itemName, int onHand, BigDecimal weightedAveragePurchaseCost,
                               BigDecimal estimatedValue) {}

    public record ValuationReport(List<ValuationRow> rows, BigDecimal estimatedTotalValue, int unpricedItemCount,
                                  long unpricedUnits, String costMethodNote) {}
}
