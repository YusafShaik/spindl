import { useState, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type TooltipProps,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Package,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from 'lucide-react';
import { KpiCard } from './KpiCard';
import { formatCompactRupees, formatCurrency } from '../../lib/utils/currency';
import { TransactionTable } from '../../components/ui/TransactionTable';
import type { TransactionRecord } from '../../types/transaction';

export interface DashboardMetrics {
  salesThisMonth: number | string;
  openOrders: number | string;
  inventoryValue: number | string;
  activeCustomers: number | string;
  lowStockItems: number | string;
  accountsReceivable: number | string;
  overdueReceivables: number | string;
  accountsPayable: number | string;
  overduePayables: number | string;
}

export interface DashboardTrendPoint {
  label: string;
  sales?: number | string | null;
  purchases?: number | string | null;
}

export interface DashboardItem {
  id: string;
  sku: string;
  name: string;
  available: number | string;
  unit: string;
  lowStockThreshold: number | string;
}

export interface DashboardProps {
  metrics: DashboardMetrics;
  trend: DashboardTrendPoint[];
  items: DashboardItem[];
  transactions: TransactionRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpenInventory: () => void;
  onSearchInventory: (sku: string) => void;
  onOpenTransactions: () => void;
  onNavigate?: (section: string) => void;
}

type TimeRange = '30d' | '90d' | '6m' | '1y';
type TriageFilter = 'all' | 'stock' | 'financial';
type TxTab = 'ALL' | 'INVOICE' | 'BILL' | 'PAYMENT';

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function LinearChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const sales = Number(payload.find((p) => p.name === 'sales')?.value || 0);
  const purchases = Number(payload.find((p) => p.name === 'purchases')?.value || 0);
  const net = sales - purchases;

  return (
    <div className="chart-custom-tooltip">
      <div className="tooltip-header">{label}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">
          <i className="legend-dot sales-dot" /> Invoiced sales
        </span>
        <b className="tooltip-value">{formatCurrency(sales)}</b>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">
          <i className="legend-dot purchase-dot" /> Supplier bills
        </span>
        <b className="tooltip-value">{formatCurrency(purchases)}</b>
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-row">
        <span className="tooltip-label">Net cashflow</span>
        <b className={`tooltip-value ${net >= 0 ? 'text-positive' : 'text-warning'}`}>
          {net >= 0 ? '+' : ''}{formatCurrency(net)}
        </b>
      </div>
    </div>
  );
}

export function Dashboard({
  metrics,
  trend,
  items,
  transactions,
  query,
  onQueryChange,
  onOpenInventory,
  onSearchInventory,
  onOpenTransactions,
  onNavigate,
}: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  const [txTab, setTxTab] = useState<TxTab>('ALL');

  // Low stock calculations
  const lowStockItems = useMemo(
    () => items.filter((item) => Number(item.available) <= Number(item.lowStockThreshold)),
    [items]
  );
  const lowStockCount = lowStockItems.length;

  // Financial triage items
  const overdueReceivable = Number(metrics.overdueReceivables || 0);
  const overduePayable = Number(metrics.overduePayables || 0);
  const openOrdersCount = Number(metrics.openOrders || 0);

  const financeCount =
    (overdueReceivable > 0 ? 1 : 0) +
    (overduePayable > 0 ? 1 : 0) +
    (openOrdersCount > 0 ? 1 : 0);
  const totalTriageCount = lowStockCount + financeCount;

  // Filtered trend points based on time range
  const filteredTrend = useMemo(() => {
    if (!trend.length) return [];
    if (timeRange === '30d') return trend.slice(-2);
    if (timeRange === '90d') return trend.slice(-3);
    if (timeRange === '6m') return trend.slice(-6);
    return trend;
  }, [trend, timeRange]);

  const totalPeriodSales = useMemo(
    () => filteredTrend.reduce((sum, p) => sum + Number(p.sales || 0), 0),
    [filteredTrend]
  );
  const totalPeriodPurchases = useMemo(
    () => filteredTrend.reduce((sum, p) => sum + Number(p.purchases || 0), 0),
    [filteredTrend]
  );
  const periodNetMargin = totalPeriodSales - totalPeriodPurchases;

  // Counts for transaction tabs
  const txCounts = useMemo(() => {
    let invoices = 0;
    let bills = 0;
    let payments = 0;
    for (const t of transactions) {
      const type = t.type.toLowerCase();
      if (type.includes('invoice') || t.direction === 'IN') invoices++;
      if (type.includes('bill') || type.includes('purchase') || t.direction === 'OUT') bills++;
      if (type.includes('payment') || t.method) payments++;
    }
    return { all: transactions.length, invoices, bills, payments };
  }, [transactions]);

  return (
    <div className="overview-container">
      {/* 1. Linear 6-Metric Telemetry Strip */}
      <div className="kpi-grid">
        <KpiCard
          title="Sales this month"
          value={formatCurrency(metrics.salesThisMonth)}
          badge="Invoiced"
          badgeTone="purple"
          detail="this month"
          icon={TrendingUp}
          onClick={() => (onNavigate ? onNavigate('Sales') : onOpenTransactions())}
        />
        <KpiCard
          title="Accounts receivable"
          value={formatCurrency(metrics.accountsReceivable)}
          badge={overdueReceivable > 0 ? `Overdue ${formatCurrency(overdueReceivable)}` : 'Current'}
          badgeTone={overdueReceivable > 0 ? 'warning' : 'neutral'}
          detail="unpaid"
          icon={DollarSign}
          onClick={() => (onNavigate ? onNavigate('Sales') : onOpenTransactions())}
        />
        <KpiCard
          title="Accounts payable"
          value={formatCurrency(metrics.accountsPayable)}
          badge={overduePayable > 0 ? `Overdue ${formatCurrency(overduePayable)}` : 'Current'}
          badgeTone={overduePayable > 0 ? 'warning' : 'neutral'}
          detail="due bills"
          icon={CreditCard}
          onClick={() => (onNavigate ? onNavigate('Purchases') : onOpenTransactions())}
        />
        <KpiCard
          title="Inventory value"
          value={formatCompactRupees(metrics.inventoryValue)}
          badge={`${items.length} SKUs`}
          badgeTone="neutral"
          detail="catalog value"
          icon={Boxes}
          onClick={onOpenInventory}
        />
        <KpiCard
          title="Open orders"
          value={metrics.openOrders}
          badge={openOrdersCount > 0 ? 'Pending' : 'Fulfilled'}
          badgeTone={openOrdersCount > 0 ? 'warning' : 'positive'}
          detail="in queue"
          icon={ShoppingCart}
          onClick={() => (onNavigate ? onNavigate('Sales') : onOpenTransactions())}
        />
        <KpiCard
          title="Active customers"
          value={metrics.activeCustomers}
          badge="Verified"
          badgeTone="positive"
          detail="clients"
          icon={Users}
          onClick={() => (onNavigate ? onNavigate('Customers') : undefined)}
        />
      </div>

      {/* 2. Business Overview Chart & Operational Triage Queue */}
      <div className="dashboard-grid">
        {/* Performance Chart Panel */}
        <section className="panel chart-panel">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Business overview</h2>
              <p>Invoiced sales and supplier bills by period</p>
            </div>
            <div className="chart-header-actions">
              <div className="segmented-control" role="tablist" aria-label="Time range">
                <button
                  type="button"
                  className={timeRange === '30d' ? 'active' : ''}
                  onClick={() => setTimeRange('30d')}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={timeRange === '90d' ? 'active' : ''}
                  onClick={() => setTimeRange('90d')}
                >
                  90D
                </button>
                <button
                  type="button"
                  className={timeRange === '6m' ? 'active' : ''}
                  onClick={() => setTimeRange('6m')}
                >
                  6M
                </button>
                <button
                  type="button"
                  className={timeRange === '1y' ? 'active' : ''}
                  onClick={() => setTimeRange('1y')}
                >
                  1Y
                </button>
              </div>
            </div>
          </div>

          <div className="chart-legend chart-legend-interactive">
            <span className="legend-item">
              <i className="legend-dot sales-dot" />
              Sales <b>{formatCurrency(totalPeriodSales)}</b>
            </span>
            <span className="legend-item">
              <i className="legend-dot purchase-dot" />
              Purchases <b>{formatCurrency(totalPeriodPurchases)}</b>
            </span>
            <span className="chart-net-badge">
              Net cashflow{' '}
              <b style={{ color: periodNetMargin >= 0 ? 'var(--sp-success)' : 'var(--sp-warning)' }}>
                {periodNetMargin >= 0 ? '+' : ''}{formatCurrency(periodNetMargin)}
              </b>
            </span>
          </div>

          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredTrend} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5E46C1" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#5E46C1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#F0F1F4" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#E8E9ED' }}
                  tick={{ fill: '#8E929C', fontSize: 11, fontFamily: 'Inter' }}
                  tickMargin={10}
                />
                <Tooltip content={<LinearChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="purchases"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  fill="url(#purchaseFill)"
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="sales"
                  stroke="#5E46C1"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Operational Triage / Needs Attention */}
        <section className="panel attention-panel">
          <div className="panel-header attention-panel-header">
            <div>
              <h2>
                Needs attention{' '}
                {totalTriageCount > 0 && (
                  <span className="attention-badge-pill">
                    {totalTriageCount}
                  </span>
                )}
              </h2>
              <p>Operational alerts requiring review or action</p>
            </div>
            <button
              className="icon-action-btn"
              onClick={onOpenInventory}
              aria-label="View all inventory"
              title="Open inventory"
            >
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Triage filter tabs */}
          <div className="triage-tabs" role="tablist">
            <button
              type="button"
              className={triageFilter === 'all' ? 'active' : ''}
              onClick={() => setTriageFilter('all')}
            >
              All <span className="tab-count">{totalTriageCount}</span>
            </button>
            <button
              type="button"
              className={triageFilter === 'stock' ? 'active' : ''}
              onClick={() => setTriageFilter('stock')}
            >
              Stock alerts <span className="tab-count">{lowStockCount}</span>
            </button>
            <button
              type="button"
              className={triageFilter === 'financial' ? 'active' : ''}
              onClick={() => setTriageFilter('financial')}
            >
              Financials <span className="tab-count">{financeCount}</span>
            </button>
          </div>

          <div className="attention-list">
            {/* 1. Low stock items */}
            {(triageFilter === 'all' || triageFilter === 'stock') &&
              lowStockItems.slice(0, 4).map((item) => (
                <div className="attention-row" key={item.id}>
                  <span className="attention-icon-box">
                    <Package size={14} aria-hidden="true" />
                  </span>
                  <div className="attention-copy">
                    <span className="attention-name">{item.name}</span>
                    <span className="attention-meta">
                      {item.available} {item.unit} available · threshold {item.lowStockThreshold}
                    </span>
                  </div>
                  <button
                    className="linear-btn-compact"
                    onClick={() => onSearchInventory(item.sku)}
                    title={`Inspect ${item.sku} in inventory`}
                  >
                    Review
                  </button>
                </div>
              ))}

            {/* 2. Overdue receivables */}
            {(triageFilter === 'all' || triageFilter === 'financial') && overdueReceivable > 0 && (
              <div className="attention-row">
                <span className="attention-icon-box warning">
                  <Clock size={14} aria-hidden="true" />
                </span>
                <div className="attention-copy">
                  <span className="attention-name">Overdue customer receivables</span>
                  <span className="attention-meta">{formatCurrency(overdueReceivable)} past payment due date</span>
                </div>
                <button
                  className="linear-btn-compact"
                  onClick={() => (onNavigate ? onNavigate('Sales') : onOpenTransactions())}
                >
                  Inspect
                </button>
              </div>
            )}

            {/* 3. Overdue payables */}
            {(triageFilter === 'all' || triageFilter === 'financial') && overduePayable > 0 && (
              <div className="attention-row">
                <span className="attention-icon-box warning">
                  <AlertTriangle size={14} aria-hidden="true" />
                </span>
                <div className="attention-copy">
                  <span className="attention-name">Overdue supplier payables</span>
                  <span className="attention-meta">{formatCurrency(overduePayable)} awaiting supplier disbursement</span>
                </div>
                <button
                  className="linear-btn-compact"
                  onClick={() => (onNavigate ? onNavigate('Purchases') : onOpenTransactions())}
                >
                  Pay bills
                </button>
              </div>
            )}

            {/* 4. Open orders */}
            {(triageFilter === 'all' || triageFilter === 'financial') && openOrdersCount > 0 && (
              <div className="attention-row">
                <span className="attention-icon-box">
                  <ShoppingCart size={14} aria-hidden="true" />
                </span>
                <div className="attention-copy">
                  <span className="attention-name">Orders awaiting fulfillment</span>
                  <span className="attention-meta">{openOrdersCount} customer orders pending shipment</span>
                </div>
                <button
                  className="linear-btn-compact"
                  onClick={() => (onNavigate ? onNavigate('Sales') : onOpenTransactions())}
                >
                  Dispatch
                </button>
              </div>
            )}

            {/* Clean state */}
            {totalTriageCount === 0 && (
              <div className="attention-empty-state">
                <CheckCircle2 size={24} className="empty-check-icon" aria-hidden="true" />
                <b>All operations running smoothly</b>
                <small>All inventory thresholds and financial obligations are up to date.</small>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3. Recent Transactions / Activity Ledger */}
      <section className="panel table-panel">
        <div className="panel-header table-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>Latest customer invoices, supplier bills, and payment records</p>
          </div>
          <button className="text-button" onClick={onOpenTransactions}>
            View full register <ArrowRight size={13} />
          </button>
        </div>

        {/* Transaction Type Filter Tabs + Search bar */}
        <div className="table-controls table-controls-enhanced">
          <div className="tx-tabs" role="tablist">
            <button
              type="button"
              className={`tx-tab-btn ${txTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setTxTab('ALL')}
            >
              All <span className="tab-count">{txCounts.all}</span>
            </button>
            <button
              type="button"
              className={`tx-tab-btn ${txTab === 'INVOICE' ? 'active' : ''}`}
              onClick={() => setTxTab('INVOICE')}
            >
              Sales invoices <span className="tab-count">{txCounts.invoices}</span>
            </button>
            <button
              type="button"
              className={`tx-tab-btn ${txTab === 'BILL' ? 'active' : ''}`}
              onClick={() => setTxTab('BILL')}
            >
              Supplier bills <span className="tab-count">{txCounts.bills}</span>
            </button>
            <button
              type="button"
              className={`tx-tab-btn ${txTab === 'PAYMENT' ? 'active' : ''}`}
              onClick={() => setTxTab('PAYMENT')}
            >
              Payments <span className="tab-count">{txCounts.payments}</span>
            </button>
          </div>

          <div className="table-search-actions">
            <div className="search-box">
              <Search size={14} aria-hidden="true" />
              <input
                className="search-input"
                placeholder="Search transactions..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
              <kbd>/</kbd>
            </div>
            {query && (
              <button className="filter-button" onClick={() => onQueryChange('')}>
                <SlidersHorizontal size={14} aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>

        <TransactionTable query={query} transactions={transactions} typeFilter={txTab} />
      </section>
    </div>
  );
}
