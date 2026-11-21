package si.spindl.dashboard;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.catalog.ItemRepository;
import si.spindl.party.CustomerRepository;
import si.spindl.finance.InvoiceRepository;
import si.spindl.sales.SalesOrderRepository;
import si.spindl.purchasing.SupplierBillRepository;
import si.spindl.identity.TenantRepository;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DashboardService {
    private final ItemRepository items;
    private final CustomerRepository customers;
    private final InvoiceRepository invoices;
    private final SalesOrderRepository orders;
    private final SupplierBillRepository supplierBills;
    private final TenantRepository tenants;

    public DashboardDtos.Summary getSummary(UUID tenantId) {
        ZoneId zone = tenants.findById(tenantId).map(t -> ZoneId.of(t.getTimezone())).orElse(ZoneId.of("UTC"));
        var today = java.time.LocalDate.now(zone);
        var start = today.withDayOfMonth(1).atStartOfDay(zone).toInstant();
        return new DashboardDtos.Summary(
                invoices.invoicedSince(tenantId, start),
                Math.toIntExact(orders.countByTenantIdAndStatusIn(tenantId, List.of("confirmed", "partially_shipped"))),
                items.calculateInventoryValue(tenantId).orElse(BigDecimal.ZERO),
                customers.countByTenantIdAndActiveTrue(tenantId),
                Math.toIntExact(items.countLowStock(tenantId)),
                invoices.outstandingReceivables(tenantId),
                invoices.overdueReceivables(tenantId, today),
                supplierBills.outstandingPayables(tenantId),
                supplierBills.overduePayables(tenantId, today)
        );
    }

    public List<DashboardDtos.TrendPoint> getTrend(UUID tenantId, int months) {
        int count = Math.max(1, Math.min(months, 24));
        ZoneId zone = tenants.findById(tenantId).map(t -> ZoneId.of(t.getTimezone())).orElse(ZoneId.of("UTC"));
        YearMonth current = YearMonth.now(zone);
        YearMonth first = current.minusMonths(count - 1L);
        var from = first.atDay(1).atStartOfDay(zone).toInstant();
        var until = current.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant();
        Map<String, BigDecimal> sales = invoices.monthlyInvoiced(tenantId, from, until).stream()
                .collect(Collectors.toMap(InvoiceRepository.MonthlyAmountRow::getPeriod, InvoiceRepository.MonthlyAmountRow::getAmount));
        Map<String, BigDecimal> purchases = supplierBills.monthlyBilled(tenantId, from, until).stream()
                .collect(Collectors.toMap(SupplierBillRepository.MonthlyAmountRow::getPeriod, SupplierBillRepository.MonthlyAmountRow::getAmount));
        return LongStream.range(0, count).mapToObj(offset -> {
            YearMonth period = first.plusMonths(offset);
            String key = period.toString();
            return new DashboardDtos.TrendPoint(
                    key,
                    period.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ROOT),
                    sales.getOrDefault(key, BigDecimal.ZERO),
                    purchases.getOrDefault(key, BigDecimal.ZERO)
            );
        }).toList();
    }

    public DashboardDtos.Alerts getAlerts(UUID tenantId) {
        return new DashboardDtos.Alerts(
                items.findLowStock(tenantId).stream()
                        .map(item -> new DashboardDtos.LowStockItem(
                                item.getId(),
                                item.getSku(),
                                item.getName(),
                                item.getOnHand(),
                                item.getReservedQuantity(),
                                item.getAvailableQuantity(),
                                item.getLowStockThreshold(),
                                item.getUnit()
                        ))
                        .toList()
        );
    }
}
