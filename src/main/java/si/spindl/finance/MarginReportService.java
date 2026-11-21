package si.spindl.finance;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.purchasing.PurchaseOrderLineEntity;
import si.spindl.purchasing.PurchaseOrderRepository;
import si.spindl.catalog.ItemRepository;
import si.spindl.tenant.DevelopmentTenant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class MarginReportService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private final DevelopmentTenant tenant;
    private final InvoiceRepository invoices;
    private final PurchaseOrderRepository purchaseOrders;
    private final ItemRepository items;

    public MarginReportService(DevelopmentTenant tenant, InvoiceRepository invoices, PurchaseOrderRepository purchaseOrders, ItemRepository items) {
        this.tenant = tenant;
        this.invoices = invoices;
        this.purchaseOrders = purchaseOrders;
        this.items = items;
    }

    @Transactional(readOnly = true)
    public MarginReport report(LocalDate from, LocalDate to) {
        validate(from, to);
        UUID tenantId = tenant.currentTenantId();
        Map<UUID, CostBasis> costs = costBasis(tenantId);
        Map<GroupKey, Accumulator> groups = new TreeMap<>();
        Set<UUID> unpricedItems = new HashSet<>();
        BigDecimal unpricedSales = BigDecimal.ZERO;
        for (var invoice : invoices.findAllByTenantIdOrderByIssuedAtDesc(tenantId)) {
            LocalDate issued = invoice.getIssuedAt().atZone(ZoneOffset.UTC).toLocalDate();
            if (from != null && issued.isBefore(from) || to != null && issued.isAfter(to)) continue;
            for (var line : invoice.getLines()) {
                int units = line.getQuantity() - line.getCreditedQuantity();
                if (units <= 0) continue;
                UUID itemId = line.getSalesOrderLine().getItem().getId();
                BigDecimal revenue = line.getUnitPrice().multiply(BigDecimal.valueOf(units)).setScale(2, RoundingMode.HALF_UP);
                CostBasis basis = costs.get(itemId);
                if (basis == null || basis.units == 0) {
                    unpricedItems.add(itemId);
                    unpricedSales = unpricedSales.add(revenue);
                    continue;
                }
                BigDecimal unitCost = basis.value.divide(BigDecimal.valueOf(basis.units), 8, RoundingMode.HALF_UP);
                BigDecimal cogs = unitCost.multiply(BigDecimal.valueOf(units)).setScale(2, RoundingMode.HALF_UP);
                String period = invoice.getIssuedAt().atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1).toString().substring(0, 7);
                GroupKey key = new GroupKey(period, line.getSku(), line.getItemName());
                Accumulator accumulator = groups.computeIfAbsent(key, ignored -> new Accumulator());
                accumulator.units = Math.addExact(accumulator.units, units);
                accumulator.revenue = accumulator.revenue.add(revenue);
                accumulator.cogs = accumulator.cogs.add(cogs);
            }
        }
        List<MarginRow> rows = groups.entrySet().stream().map(entry -> {
            var key = entry.getKey();
            var value = entry.getValue();
            BigDecimal margin = value.revenue.subtract(value.cogs).setScale(2, RoundingMode.HALF_UP);
            BigDecimal percent = value.revenue.signum() == 0 ? BigDecimal.ZERO : margin.multiply(HUNDRED).divide(value.revenue, 2, RoundingMode.HALF_UP);
            return new MarginRow(key.period(), key.sku(), key.itemName(), value.units, value.revenue.setScale(2, RoundingMode.HALF_UP), value.cogs.setScale(2, RoundingMode.HALF_UP), margin, percent);
        }).toList();
        return new MarginReport(rows, unpricedItems.size(), unpricedSales.setScale(2, RoundingMode.HALF_UP), "Estimated from quantity-weighted accepted purchase prices. Tax is excluded; sales are reduced by credited units. Items without purchase cost history are excluded from gross margin.");
    }

    @Transactional(readOnly = true)
    public ValuationReport inventoryValuation() {
        UUID tenantId = tenant.currentTenantId();
        Map<UUID, CostBasis> costs = costBasis(tenantId);
        List<ValuationRow> rows = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        int unpriced = 0;
        long unpricedUnits = 0;
        for (var item : items.findAllByTenantIdAndActiveTrueOrderByName(tenantId)) {
            CostBasis basis = costs.get(item.getId());
            BigDecimal average = basis == null || basis.units == 0 ? null : basis.value.divide(BigDecimal.valueOf(basis.units), 8, RoundingMode.HALF_UP);
            BigDecimal value = average == null ? null : average.multiply(BigDecimal.valueOf(item.getOnHand())).setScale(2, RoundingMode.HALF_UP);
            if (value == null) {
                unpriced++;
                unpricedUnits += item.getOnHand();
            } else total = total.add(value);
            rows.add(new ValuationRow(item.getSku(), item.getName(), item.getOnHand(), average, value));
        }
        return new ValuationReport(rows, total.setScale(2, RoundingMode.HALF_UP), unpriced, unpricedUnits, "Estimated at quantity-weighted accepted purchase cost. Includes on-hand units across locations; held and reserved units remain part of on-hand stock. Items without accepted purchase history are excluded from total value.");
    }

    @Transactional(readOnly = true)
    public String export(LocalDate from, LocalDate to) {
        MarginReport report = report(from, to);
        StringBuilder csv = new StringBuilder("period,sku,item,net_units,net_sales,estimated_cost_of_goods,estimated_gross_margin,margin_percent\r\n");
        for (MarginRow row : report.rows())
            csv.append(String.join(",", cell(row.period()), cell(row.sku()), cell(row.itemName()), Integer.toString(row.netUnits()), row.netSales().toPlainString(), row.estimatedCostOfGoods().toPlainString(), row.estimatedGrossMargin().toPlainString(), row.marginPercent().toPlainString())).append("\r\n");
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public String exportInventoryValuation() {
        ValuationReport report = inventoryValuation();
        StringBuilder csv = new StringBuilder("sku,item,on_hand,weighted_average_purchase_cost,estimated_stock_value\r\n");
        for (ValuationRow row : report.rows())
            csv.append(String.join(",", cell(row.sku()), cell(row.itemName()), Integer.toString(row.onHand()), row.weightedAveragePurchaseCost() == null ? "" : row.weightedAveragePurchaseCost().toPlainString(), row.estimatedValue() == null ? "" : row.estimatedValue().toPlainString())).append("\r\n");
        return csv.toString();
    }

    private Map<UUID, CostBasis> costBasis(UUID tenantId) {
        Map<UUID, CostBasis> costs = new HashMap<>();
        for (var order : purchaseOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId))
            for (PurchaseOrderLineEntity line : order.getLines()) {
                int received = line.getAcceptedQuantity() - line.getReturnedQuantity();
                if (received <= 0) continue;
                CostBasis basis = costs.computeIfAbsent(line.getItem().getId(), ignored -> new CostBasis());
                basis.units = Math.addExact(basis.units, received);
                basis.value = basis.value.add(line.getUnitPrice().multiply(BigDecimal.valueOf(received)));
            }
        return costs;
    }

    private void validate(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "From date must not be after the to date");
        if (from != null && from.isAfter(LocalDate.now(ZoneOffset.UTC)) || to != null && to.isAfter(LocalDate.now(ZoneOffset.UTC)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Margin report dates cannot be in the future");
    }

    private String cell(String value) {
        String safe = value == null ? "" : value.replaceAll("^[\\s]*([=+@-])", "'$1");
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private record GroupKey(String period, String sku, String itemName) implements Comparable<GroupKey> {
        public int compareTo(GroupKey other) {
            int byPeriod = period.compareTo(other.period);
            return byPeriod != 0 ? byPeriod : sku.compareToIgnoreCase(other.sku);
        }
    }

    private static final class CostBasis {
        private long units;
        private BigDecimal value = BigDecimal.ZERO;
    }

    private static final class Accumulator {
        private int units;
        private BigDecimal revenue = BigDecimal.ZERO;
        private BigDecimal cogs = BigDecimal.ZERO;
    }

    public record MarginRow(String period, String sku, String itemName, int netUnits, BigDecimal netSales,
                            BigDecimal estimatedCostOfGoods, BigDecimal estimatedGrossMargin,
                            BigDecimal marginPercent) {
    }

    public record MarginReport(List<MarginRow> rows, int unpricedItemCount, BigDecimal unpricedSales,
                               String costMethodNote) {
    }

    public record ValuationRow(String sku, String itemName, int onHand, BigDecimal weightedAveragePurchaseCost,
                               BigDecimal estimatedValue) {
    }

    public record ValuationReport(List<ValuationRow> rows, BigDecimal estimatedTotalValue, int unpricedItemCount,
                                  long unpricedUnits, String costMethodNote) {
    }
}
