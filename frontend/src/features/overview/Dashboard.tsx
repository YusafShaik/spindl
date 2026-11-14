import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Boxes, Search, ShoppingCart, SlidersHorizontal, Users } from 'lucide-react';
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

interface DashboardProps {
  metrics: DashboardMetrics;
  trend: DashboardTrendPoint[];
  items: DashboardItem[];
  transactions: TransactionRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpenInventory: () => void;
  onSearchInventory: (sku: string) => void;
  onOpenTransactions: () => void;
}

export function Dashboard({ metrics, trend, items, transactions, query, onQueryChange, onOpenInventory, onSearchInventory, onOpenTransactions }: DashboardProps) {
  const lowStockItems = items.filter((item) => Number(item.available) <= Number(item.lowStockThreshold)).slice(0, 5);
  const lowStockCount = Number(metrics.lowStockItems || 0);

  return <>
    <div className="kpi-grid">
      <KpiCard title="Sales this month" value={formatCurrency(metrics.salesThisMonth)} change="From invoices" detail="invoices issued this month" icon={ArrowUpRight} accent="purple" spark="sales" />
      <KpiCard title="Open orders" value={metrics.openOrders} change="From database" detail="orders awaiting full shipment" icon={ShoppingCart} accent="amber" spark="orders" />
      <KpiCard title="Inventory value" value={formatCompactRupees(metrics.inventoryValue)} change="From catalog" detail="opening stock × unit price" icon={Boxes} accent="blue" spark="inventory" />
      <KpiCard title="Active customers" value={metrics.activeCustomers} change="From database" detail="active customer records" icon={Users} accent="green" spark="customers" />
      <KpiCard title="Accounts receivable" value={formatCurrency(metrics.accountsReceivable)} change={`Overdue ${formatCurrency(metrics.overdueReceivables)}`} detail="unpaid customer invoices" icon={ArrowUpRight} accent="blue" spark="sales" />
      <KpiCard title="Accounts payable" value={formatCurrency(metrics.accountsPayable)} change={`Overdue ${formatCurrency(metrics.overduePayables)}`} detail="unpaid supplier bills" icon={ArrowDownLeft} accent="amber" spark="orders" />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-header"><div><h2>Business overview</h2><p>Invoiced sales and supplier bills by month</p></div><span className="select-button">Last 6 months</span></div>
        <div className="chart-legend">
          <span><i className="legend-dot sales-dot" />Sales <b>{formatCurrency(trend.reduce((total, point) => total + Number(point.sales || 0), 0))}</b></span>
          <span><i className="legend-dot purchase-dot" />Purchases <b>{formatCurrency(trend.reduce((total, point) => total + Number(point.purchases || 0), 0))}</b></span>
        </div>
        <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 10, right: 5, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7257d8" stopOpacity={0.18} /><stop offset="95%" stopColor="#7257d8" stopOpacity={0} /></linearGradient>
              <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a9a1c7" stopOpacity={0.12} /><stop offset="95%" stopColor="#a9a1c7" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eef0f3" strokeDasharray="3 5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#9aa0aa', fontSize: 11 }} tickMargin={12} />
            <Tooltip formatter={(value, name) => [formatCurrency(String(value ?? 0)), name === 'sales' ? 'Invoiced sales' : 'Supplier bills']} contentStyle={{ border: '1px solid #ececf1', borderRadius: 10, boxShadow: '0 8px 24px #20233a12', fontSize: 12 }} />
            <Area type="monotone" dataKey="purchases" name="purchases" stroke="#b0a8ca" strokeWidth={2} fill="url(#purchaseFill)" />
            <Area type="monotone" dataKey="sales" name="sales" stroke="#7257d8" strokeWidth={2.5} fill="url(#salesFill)" />
          </AreaChart>
        </ResponsiveContainer></div>
      </section>
      <section className="panel attention-panel">
        <div className="panel-header"><div><h2>Needs attention <span className="attention-count">{metrics.lowStockItems || 0}</span></h2><p>Items at or below their availability threshold</p></div><button className="more-button" onClick={onOpenInventory} aria-label="Open inventory"><ArrowRight size={16} /></button></div>
        <div className="attention-list">
          {lowStockItems.map((item) => <div className="attention-row" key={item.id}>
            <span className="attention-icon orange"><Boxes size={15} aria-hidden="true" /></span>
            <div className="attention-copy"><b>{item.name}</b><small>{item.available} {item.unit} available · threshold {item.lowStockThreshold}</small></div>
            <button onClick={() => onSearchInventory(item.sku)}>Review</button>
          </div>)}
          {lowStockCount === 0 && <div className="empty-cell">All active items are above their low-stock thresholds.</div>}
        </div>
      </section>
    </div>
    <section className="panel table-panel">
      <div className="panel-header table-heading"><div><h2>Recent transactions</h2><p>Latest invoices, bills, payments, and supplier credits</p></div><button className="text-button" onClick={onOpenTransactions}>View all <ArrowRight size={14} /></button></div>
      <div className="table-controls"><div className="search-box"><Search size={15} aria-hidden="true" /><input className="search-input" placeholder="Search transactions..." value={query} onChange={(event) => onQueryChange(event.target.value)} /><kbd>/</kbd></div><button className="filter-button" onClick={() => onQueryChange('')}><SlidersHorizontal size={15} aria-hidden="true" /> Clear search</button></div>
      <TransactionTable query={query} transactions={transactions} />
    </section>
  </>;
}
