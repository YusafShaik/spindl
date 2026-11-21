package si.spindl.dashboard;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import si.spindl.catalog.ItemRepository;
import si.spindl.party.CustomerRepository;
import si.spindl.tenant.DevelopmentTenant;
import si.spindl.finance.InvoiceRepository;
import si.spindl.sales.SalesOrderRepository;
import si.spindl.purchasing.SupplierBillRepository;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final ItemRepository items;
    private final CustomerRepository customers;
    private final DevelopmentTenant tenant;
    private final InvoiceRepository invoices;
    private final SalesOrderRepository orders;
    private final SupplierBillRepository supplierBills;
    private final si.spindl.identity.TenantRepository tenants;

    public DashboardController(ItemRepository items, CustomerRepository customers, DevelopmentTenant tenant, InvoiceRepository invoices, SalesOrderRepository orders, SupplierBillRepository supplierBills, si.spindl.identity.TenantRepository tenants) {
        this.items = items;
        this.customers = customers;
        this.tenant = tenant;
        this.invoices = invoices;
        this.orders = orders;
        this.supplierBills = supplierBills;
        this.tenants = tenants;
    }

    @GetMapping("/summary")
    public Summary summary() {
        var tenantId = tenant.currentTenantId();
        ZoneId zone = tenants.findById(tenantId).map(t -> ZoneId.of(t.getTimezone())).orElse(ZoneId.of("UTC"));
        var today = java.time.LocalDate.now(zone);
        var start = today.withDayOfMonth(1).atStartOfDay(zone).toInstant();
        return new Summary(invoices.invoicedSince(tenantId, start), Math.toIntExact(orders.countByTenantIdAndStatusIn(tenantId, java.util.List.of("confirmed", "partially_shipped"))), items.calculateInventoryValue(tenantId).orElse(BigDecimal.ZERO), customers.countByTenantIdAndActiveTrue(tenantId), Math.toIntExact(items.countLowStock(tenantId)), invoices.outstandingReceivables(tenantId), invoices.overdueReceivables(tenantId, today), supplierBills.outstandingPayables(tenantId), supplierBills.overduePayables(tenantId, today));
    }

    @GetMapping("/trend")
    public List<TrendPoint> trend(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "6") int months) {
        int count = Math.max(1, Math.min(months, 24));
        UUID tenantId = tenant.currentTenantId();
        ZoneId zone = tenants.findById(tenantId).map(t -> ZoneId.of(t.getTimezone())).orElse(ZoneId.of("UTC"));
        YearMonth current = YearMonth.now(zone);
        YearMonth first = current.minusMonths(count - 1L);
        var from = first.atDay(1).atStartOfDay(zone).toInstant();
        var until = current.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant();
        Map<String, BigDecimal> sales = invoices.monthlyInvoiced(tenantId, from, until).stream().collect(Collectors.toMap(InvoiceRepository.MonthlyAmountRow::getPeriod, InvoiceRepository.MonthlyAmountRow::getAmount));
        Map<String, BigDecimal> purchases = supplierBills.monthlyBilled(tenantId, from, until).stream().collect(Collectors.toMap(si.spindl.purchasing.SupplierBillRepository.MonthlyAmountRow::getPeriod, si.spindl.purchasing.SupplierBillRepository.MonthlyAmountRow::getAmount));
        return java.util.stream.LongStream.range(0, count).mapToObj(offset -> {
            YearMonth period = first.plusMonths(offset);
            String key = period.toString();
            return new TrendPoint(key, period.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ROOT), sales.getOrDefault(key, BigDecimal.ZERO), purchases.getOrDefault(key, BigDecimal.ZERO));
        }).toList();
    }

    @GetMapping("/alerts")
    public Alerts alerts() {
        return new Alerts(items.findLowStock(tenant.currentTenantId()).stream().map(item -> new LowStockItem(item.getId(), item.getSku(), item.getName(), item.getOnHand(), item.getReservedQuantity(), item.getAvailableQuantity(), item.getLowStockThreshold(), item.getUnit())).toList());
    }

    public record Summary(BigDecimal salesThisMonth, int openOrders, BigDecimal inventoryValue, long activeCustomers,
                          int lowStockItems, BigDecimal accountsReceivable, BigDecimal overdueReceivables,
                          BigDecimal accountsPayable, BigDecimal overduePayables) {
    }

    public record TrendPoint(String period, String label, BigDecimal sales, BigDecimal purchases) {
    }

    public record Alerts(List<LowStockItem> lowStockItems) {
    }

    public record LowStockItem(UUID itemId, String sku, String name, int onHand, int reserved, int available,
                               int threshold, String unit) {
    }
}
