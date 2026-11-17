import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  Calendar,
  Clock,
  Download,
  FileText,
  Filter,
  GitBranch,
  Layers,
  Percent,
  Receipt,
  RefreshCw,
  Search,
  Sliders,
  TrendingUp,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { ReportBuilder, SavedReportSchedulePanel } from './ReportBuilder';
import { WorkflowStudio } from './WorkflowStudio';
import { InvoiceTemplateDesigner } from '../transactions/InvoiceTemplateDesigner';
import { LeadPipelineStudio } from '../leads/LeadPipelineStudio';

export type ReportKind = 'receivables' | 'payables' | 'margins' | 'inventory-valuation';
type MoneyValue = number | string;

export interface AgingRow {
  reference: string;
  counterparty: string;
  dueDate: string;
  originalAmount: MoneyValue;
  paidOrCredited: MoneyValue;
  balance: MoneyValue;
  ageBucket: string;
}

export interface MarginRow {
  period: string;
  sku: string;
  itemName: string;
  netUnits: number;
  netSales: MoneyValue;
  estimatedCostOfGoods: MoneyValue;
  estimatedGrossMargin: MoneyValue;
  marginPercent: MoneyValue;
}

export interface ValuationRow {
  sku: string;
  itemName: string;
  onHand: number;
  weightedAveragePurchaseCost: MoneyValue | null;
  estimatedValue: MoneyValue | null;
}

export interface MarginReport {
  rows: MarginRow[];
  unpricedItemCount: number;
  unpricedSales: MoneyValue;
  costMethodNote: string;
}

export interface ValuationReport {
  rows: ValuationRow[];
  estimatedTotalValue: MoneyValue;
  unpricedItemCount: number;
  unpricedUnits: number;
  costMethodNote: string;
}

export interface OperationalReportsProps {
  notify: (message: string) => void;
  role?: string;
  enhancements?: ReactNode;
}

type ReportsSubTab = 'operational' | 'builder' | 'schedules' | 'workflows' | 'studios';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isReportKind(value: string): value is ReportKind {
  return ['receivables', 'payables', 'margins', 'inventory-valuation'].includes(value);
}
function isMoney(value: unknown): value is MoneyValue {
  return typeof value === 'number' || typeof value === 'string';
}
function isAgingRow(value: unknown): value is AgingRow {
  return (
    isRecord(value) &&
    typeof value.reference === 'string' &&
    typeof value.counterparty === 'string' &&
    typeof value.dueDate === 'string' &&
    typeof value.ageBucket === 'string' &&
    isMoney(value.originalAmount) &&
    isMoney(value.paidOrCredited) &&
    isMoney(value.balance)
  );
}
function isAgingRows(value: unknown): value is AgingRow[] {
  return Array.isArray(value) && value.every(isAgingRow);
}
function isMarginRow(value: unknown): value is MarginRow {
  return (
    isRecord(value) &&
    typeof value.period === 'string' &&
    typeof value.sku === 'string' &&
    typeof value.itemName === 'string' &&
    typeof value.netUnits === 'number' &&
    isMoney(value.netSales) &&
    isMoney(value.estimatedCostOfGoods) &&
    isMoney(value.estimatedGrossMargin) &&
    isMoney(value.marginPercent)
  );
}
function isValuationRow(value: unknown): value is ValuationRow {
  return (
    isRecord(value) &&
    typeof value.sku === 'string' &&
    typeof value.itemName === 'string' &&
    typeof value.onHand === 'number' &&
    (value.weightedAveragePurchaseCost === null || isMoney(value.weightedAveragePurchaseCost)) &&
    (value.estimatedValue === null || isMoney(value.estimatedValue))
  );
}
function isMarginReport(value: unknown): value is MarginReport {
  return (
    isRecord(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isMarginRow) &&
    typeof value.unpricedItemCount === 'number' &&
    isMoney(value.unpricedSales) &&
    typeof value.costMethodNote === 'string'
  );
}
function isValuationReport(value: unknown): value is ValuationReport {
  return (
    isRecord(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isValuationRow) &&
    isMoney(value.estimatedTotalValue) &&
    typeof value.unpricedItemCount === 'number' &&
    typeof value.unpricedUnits === 'number' &&
    typeof value.costMethodNote === 'string'
  );
}

export function OperationalReports({ notify, role, enhancements }: OperationalReportsProps) {
  // Sub-Navigation
  const [activeTab, setActiveTab] = useState<ReportsSubTab>('operational');
  const [studioSection, setStudioSection] = useState<'invoice' | 'pipeline'>('invoice');

  // Operational Report Controls
  const [kind, setKind] = useState<ReportKind>('receivables');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');

  // Loaded Data
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);
  const [marginRows, setMarginRows] = useState<MarginRow[]>([]);
  const [valuationRows, setValuationRows] = useState<ValuationRow[]>([]);
  const [marginMeta, setMarginMeta] = useState({
    unpricedItemCount: 0,
    unpricedSales: 0 as MoneyValue,
    costMethodNote: ''
  });
  const [valuationMeta, setValuationMeta] = useState({
    estimatedTotalValue: 0 as MoneyValue,
    unpricedItemCount: 0,
    unpricedUnits: 0,
    costMethodNote: ''
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Executive Telemetry Across All 4 Report Types
  const [executiveTelemetry, setExecutiveTelemetry] = useState({
    receivablesTotal: 15900,
    receivablesCount: 1,
    payablesTotal: 34000,
    payablesCount: 1,
    inventoryValuation: 782500,
    activeItemCount: 7,
    grossMarginPercent: 5.41,
    grossMarginAmount: 1400
  });

  const marginReport = kind === 'margins';
  const valuationReport = kind === 'inventory-valuation';
  const costingReport = marginReport || valuationReport;

  // Background Telemetry Fetch (all 4 core metrics on mount or refresh)
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`${API}/reports/receivables`).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`${API}/reports/payables`).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`${API}/reports/margins`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`${API}/reports/inventory-valuation`).then((r) => (r.ok ? r.json() : null))
    ])
      .then(([arData, apData, marginData, valData]) => {
        if (!active) return;
        const arSum = Array.isArray(arData)
          ? arData.reduce((sum: number, r: { balance?: MoneyValue }) => sum + Number(r.balance || 0), 0)
          : 0;
        const apSum = Array.isArray(apData)
          ? apData.reduce((sum: number, r: { balance?: MoneyValue }) => sum + Number(r.balance || 0), 0)
          : 0;
        const valSum = valData && typeof valData === 'object' && 'estimatedTotalValue' in valData
          ? Number((valData as { estimatedTotalValue: MoneyValue }).estimatedTotalValue || 0)
          : 0;
        const valCount = valData && typeof valData === 'object' && Array.isArray((valData as { rows: unknown[] }).rows)
          ? (valData as { rows: unknown[] }).rows.length
          : 0;
        const marginPct = marginData && typeof marginData === 'object' && Array.isArray((marginData as { rows: MarginRow[] }).rows) && (marginData as { rows: MarginRow[] }).rows[0]
          ? Number((marginData as { rows: MarginRow[] }).rows[0].marginPercent || 0)
          : 0;
        const marginTotal = marginData && typeof marginData === 'object' && Array.isArray((marginData as { rows: MarginRow[] }).rows)
          ? (marginData as { rows: MarginRow[] }).rows.reduce((sum: number, r: MarginRow) => sum + Number(r.estimatedGrossMargin || 0), 0)
          : 0;

        setExecutiveTelemetry({
          receivablesTotal: arSum,
          receivablesCount: Array.isArray(arData) ? arData.length : 0,
          payablesTotal: apSum,
          payablesCount: Array.isArray(apData) ? apData.length : 0,
          inventoryValuation: valSum,
          activeItemCount: valCount,
          grossMarginPercent: marginPct,
          grossMarginAmount: marginTotal
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [refreshIndex]);

  // Load Active Report Data
  useEffect(() => {
    let current = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (from && !valuationReport) params.set(costingReport ? 'from' : 'dueFrom', from);
    if (to && !valuationReport) params.set(costingReport ? 'to' : 'dueTo', to);

    apiFetch(`${API}/reports/${kind}?${params}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Could not load this report'))
      )
      .then((data: unknown) => {
        if (!current) return;
        if (kind === 'margins') {
          if (!isMarginReport(data)) throw new Error('Invalid sales margin report response');
          setMarginRows(data.rows || []);
          setMarginMeta({
            unpricedItemCount: data.unpricedItemCount || 0,
            unpricedSales: data.unpricedSales || 0,
            costMethodNote: data.costMethodNote || ''
          });
          setValuationMeta({
            estimatedTotalValue: 0,
            unpricedItemCount: 0,
            unpricedUnits: 0,
            costMethodNote: ''
          });
        } else if (kind === 'inventory-valuation') {
          if (!isValuationReport(data)) throw new Error('Invalid inventory valuation report response');
          setValuationRows(data.rows || []);
          setValuationMeta({
            estimatedTotalValue: data.estimatedTotalValue || 0,
            unpricedItemCount: data.unpricedItemCount || 0,
            unpricedUnits: data.unpricedUnits || 0,
            costMethodNote: data.costMethodNote || ''
          });
          setMarginMeta({ unpricedItemCount: 0, unpricedSales: 0, costMethodNote: '' });
        } else {
          if (!isAgingRows(data)) throw new Error('Invalid account aging report response');
          setAgingRows(data);
          setMarginMeta({ unpricedItemCount: 0, unpricedSales: 0, costMethodNote: '' });
          setValuationMeta({
            estimatedTotalValue: 0,
            unpricedItemCount: 0,
            unpricedUnits: 0,
            costMethodNote: ''
          });
        }
      })
      .catch((error: unknown) => {
        if (current) notify(messageFrom(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [kind, from, to, refreshIndex]);

  // Export Active Report to CSV
  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from && !valuationReport) params.set(costingReport ? 'from' : 'dueFrom', from);
      if (to && !valuationReport) params.set(costingReport ? 'to' : 'dueTo', to);
      const response = await apiFetch(`${API}/reports/${kind}/export?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.message || 'Could not export this report');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `spindl-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Report exported successfully as CSV');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setExporting(false);
    }
  };

  // Calculations for active report summary
  const total = agingRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const netSales = marginRows.reduce((sum, row) => sum + Number(row.netSales || 0), 0);
  const estimatedCogs = marginRows.reduce((sum, row) => sum + Number(row.estimatedCostOfGoods || 0), 0);
  const estimatedMargin = netSales - estimatedCogs;
  const overdueCount = agingRows.filter((row) =>
    ['31-60_DAYS', '61-90_DAYS', 'OVER_90_DAYS'].includes(row.ageBucket)
  ).length;

  const canExport = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');

  // Filtered rows based on search input
  const filteredAgingRows = useMemo(() => {
    if (!query.trim()) return agingRows;
    const q = query.toLowerCase().trim();
    return agingRows.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.counterparty.toLowerCase().includes(q) ||
        r.ageBucket.toLowerCase().includes(q)
    );
  }, [agingRows, query]);

  const filteredMarginRows = useMemo(() => {
    if (!query.trim()) return marginRows;
    const q = query.toLowerCase().trim();
    return marginRows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.period.toLowerCase().includes(q)
    );
  }, [marginRows, query]);

  const filteredValuationRows = useMemo(() => {
    if (!query.trim()) return valuationRows;
    const q = query.toLowerCase().trim();
    return valuationRows.filter(
      (r) => r.sku.toLowerCase().includes(q) || r.itemName.toLowerCase().includes(q)
    );
  }, [valuationRows, query]);

  return (
    <div className="reports-screen-layout">
      {/* 1. Executive Telemetry Strip — Quiet Monochrome Linear Architecture */}
      <div className="sales-metric-strip">
        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">ACCOUNTS RECEIVABLE</span>
            <TrendingUp size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{formatCurrency(executiveTelemetry.receivablesTotal)}</div>
          <div className="reports-metric-sub">
            {executiveTelemetry.receivablesCount} open customer {executiveTelemetry.receivablesCount === 1 ? 'invoice' : 'invoices'} · uncollected
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">ACCOUNTS PAYABLE</span>
            <Receipt size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{formatCurrency(executiveTelemetry.payablesTotal)}</div>
          <div className="reports-metric-sub">
            {executiveTelemetry.payablesCount} supplier {executiveTelemetry.payablesCount === 1 ? 'bill' : 'bills'} · pending settlement
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">INVENTORY VALUATION</span>
            <Boxes size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{formatCurrency(executiveTelemetry.inventoryValuation)}</div>
          <div className="reports-metric-sub">
            Across {executiveTelemetry.activeItemCount} catalog SKUs · weighted avg cost
          </div>
        </div>

        <div className="reports-metric-card">
          <div className="reports-metric-header">
            <span className="reports-metric-label">GROSS PROFIT MARGIN</span>
            <Percent size={14} className="reports-metric-icon" />
          </div>
          <div className="reports-metric-val">{executiveTelemetry.grossMarginPercent}% Margin</div>
          <div className="reports-metric-sub">
            {formatCurrency(executiveTelemetry.grossMarginAmount)} net margin on priced items
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="reports-subnav-container">
        <div className="reports-subnav-tabs">
          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'operational' ? 'active' : ''}`}
            onClick={() => setActiveTab('operational')}
          >
            <BarChart3 size={13} />
            <span>Operational Reports</span>
            <span className="reports-subnav-badge">4</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            <Sliders size={13} />
            <span>Report Builder</span>
            <span className="reports-subnav-badge">Custom</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'schedules' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedules')}
          >
            <Clock size={13} />
            <span>Schedules</span>
            <span className="reports-subnav-badge">Cron</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'workflows' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflows')}
          >
            <GitBranch size={13} />
            <span>Approval Workflows</span>
            <span className="reports-subnav-badge">Rules</span>
          </button>

          <button
            type="button"
            className={`reports-subnav-tab ${activeTab === 'studios' ? 'active' : ''}`}
            onClick={() => setActiveTab('studios')}
          >
            <FileText size={13} />
            <span>Design Studios</span>
            <span className="reports-subnav-badge">Templates</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="mini-action"
            onClick={() => setRefreshIndex((prev) => prev + 1)}
            title="Refresh active report data"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          {activeTab === 'operational' && canExport && (
            <button
              type="button"
              className="button button-secondary"
              disabled={exporting}
              onClick={() => void exportCsv()}
              style={{ height: '30px', fontSize: '12px' }}
            >
              <Download size={13} />
              <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Sub-Tab View Router */}
      {activeTab === 'operational' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* High-Density Toolbar: Segmented Report Picker + Dates + Search */}
          <div className="reports-toolbar">
            <div className="reports-toolbar-left">
              {/* Linear Segmented Report Picker */}
              <div className="reports-segmented-group">
                <button
                  type="button"
                  className={`reports-segmented-btn ${kind === 'receivables' ? 'active' : ''}`}
                  onClick={() => setKind('receivables')}
                >
                  Receivables (AR)
                </button>
                <button
                  type="button"
                  className={`reports-segmented-btn ${kind === 'payables' ? 'active' : ''}`}
                  onClick={() => setKind('payables')}
                >
                  Payables (AP)
                </button>
                <button
                  type="button"
                  className={`reports-segmented-btn ${kind === 'margins' ? 'active' : ''}`}
                  onClick={() => setKind('margins')}
                >
                  Sales Margins
                </button>
                <button
                  type="button"
                  className={`reports-segmented-btn ${kind === 'inventory-valuation' ? 'active' : ''}`}
                  onClick={() => setKind('inventory-valuation')}
                >
                  Inventory Valuation
                </button>
              </div>

              {/* Date Controls */}
              {!valuationReport && (
                <div className="reports-date-filter">
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                    {costingReport ? 'Period:' : 'Due:'}
                  </span>
                  <input
                    type="date"
                    className="reports-date-input"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    title="From date"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>–</span>
                  <input
                    type="date"
                    className="reports-date-input"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    title="To date"
                  />
                  {(from || to) && (
                    <button
                      type="button"
                      className="mini-action muted"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                      }}
                      style={{ height: '26px' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Filter Search Box */}
            <div className="sales-search-box" style={{ width: '260px' }}>
              <Search size={13} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder={
                  kind === 'margins'
                    ? 'Search SKU, item, period…'
                    : kind === 'inventory-valuation'
                    ? 'Search inventory SKU, item…'
                    : 'Search ref #, customer, supplier…'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="sales-search-clear"
                  onClick={() => setQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Contextual Metric Summary Strip */}
          <div className="reports-summary-strip">
            {marginReport ? (
              <>
                <div className="reports-summary-item">
                  <span className="label">Priced Net Sales</span>
                  <span className="val">{formatCurrency(netSales)}</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Estimated COGS</span>
                  <span className="val">{formatCurrency(estimatedCogs)}</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Gross Margin on Priced Items</span>
                  <span className="val">{formatCurrency(estimatedMargin)}</span>
                </div>
              </>
            ) : valuationReport ? (
              <>
                <div className="reports-summary-item">
                  <span className="label">Estimated Total Valuation</span>
                  <span className="val">{formatCurrency(valuationMeta.estimatedTotalValue)}</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Active Catalog SKUs</span>
                  <span className="val">{valuationRows.length} Items</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Units Lacking Purchase History</span>
                  <span className="val">{valuationMeta.unpricedUnits.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <div className="reports-summary-item">
                  <span className="label">
                    Total {kind === 'receivables' ? 'Receivable Balance' : 'Payable Balance'}
                  </span>
                  <span className="val">{formatCurrency(total)}</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Open Ledger Records</span>
                  <span className="val">{agingRows.length} Documents</span>
                </div>
                <div className="reports-summary-item">
                  <span className="label">Over 30 Days Overdue</span>
                  <span className="val">{overdueCount}</span>
                </div>
              </>
            )}
          </div>

          {/* High-Density Linear Table */}
          <div className="reports-table-panel">
            <div className="table-scroll" style={{ margin: 0 }}>
              <table className="reports-table">
                <thead>
                  {marginReport ? (
                    <tr>
                      <th style={{ width: '100px' }}>PERIOD</th>
                      <th style={{ width: '140px' }}>SKU</th>
                      <th>ITEM NAME</th>
                      <th style={{ textAlign: 'right', width: '100px' }}>NET UNITS</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>NET SALES</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>EST. COGS</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>GROSS MARGIN</th>
                      <th style={{ textAlign: 'right', width: '90px' }}>MARGIN %</th>
                    </tr>
                  ) : valuationReport ? (
                    <tr>
                      <th style={{ width: '160px' }}>SKU</th>
                      <th>ITEM NAME</th>
                      <th style={{ textAlign: 'right', width: '110px' }}>ON HAND</th>
                      <th style={{ textAlign: 'right', width: '180px' }}>WEIGHTED AVG. COST</th>
                      <th style={{ textAlign: 'right', width: '180px' }}>EST. STOCK VALUE</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ width: '150px' }}>REFERENCE</th>
                      <th>{kind === 'receivables' ? 'CUSTOMER' : 'SUPPLIER'}</th>
                      <th style={{ width: '120px' }}>DUE DATE</th>
                      <th style={{ width: '130px' }}>AGING STATUS</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>ORIGINAL</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>PAID / CREDITED</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>OPEN BALANCE</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="empty-cell" style={{ padding: '36px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={18} className="spin" style={{ color: 'var(--sp-text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                            Calculating operational metrics…
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : marginReport ? (
                    filteredMarginRows.length ? (
                      filteredMarginRows.map((row, index) => (
                        <tr key={`${row.period}-${row.sku}-${index}`}>
                          <td style={{ color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {row.period}
                          </td>
                          <td className="ref-cell" style={{ fontWeight: 500 }}>
                            {row.sku}
                          </td>
                          <td style={{ color: 'var(--sp-text)' }}>{row.itemName}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {row.netUnits}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(row.netSales)}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(row.estimatedCostOfGoods)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: Number(row.estimatedGrossMargin) >= 0 ? '#10b981' : '#f43f5e'
                            }}
                          >
                            {formatCurrency(row.estimatedGrossMargin)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {row.marginPercent}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-cell">
                          No margin records match this search.
                        </td>
                      </tr>
                    )
                  ) : valuationReport ? (
                    filteredValuationRows.length ? (
                      filteredValuationRows.map((row) => (
                        <tr key={row.sku}>
                          <td className="ref-cell" style={{ fontWeight: 500 }}>
                            {row.sku}
                          </td>
                          <td style={{ color: 'var(--sp-text)' }}>{row.itemName}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {row.onHand.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              color: row.weightedAveragePurchaseCost == null ? 'var(--sp-text-muted)' : 'var(--sp-text)'
                            }}
                          >
                            {row.weightedAveragePurchaseCost == null
                              ? 'No purchase history'
                              : formatCurrency(row.weightedAveragePurchaseCost)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {row.estimatedValue == null ? '—' : formatCurrency(row.estimatedValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          No valuation records match this search.
                        </td>
                      </tr>
                    )
                  ) : filteredAgingRows.length ? (
                    filteredAgingRows.map((row) => (
                      <tr key={row.reference}>
                        <td className="ref-cell" style={{ fontWeight: 500 }}>
                          {row.reference}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--sp-text)' }}>
                          {row.counterparty}
                        </td>
                        <td style={{ color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {row.dueDate}
                        </td>
                        <td>
                          <Status label={row.ageBucket.replaceAll('_', ' ').toLowerCase()} />
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(row.originalAmount)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(row.paidOrCredited)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {formatCurrency(row.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        No aging records match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footnote Calculation Methodology */}
          <div className="reports-note-box">
            {marginReport
              ? `${marginMeta.costMethodNote || 'Calculated from quantity-weighted purchase cost.'} ${
                  marginMeta.unpricedItemCount > 0
                    ? `${marginMeta.unpricedItemCount} item(s) lack cost history; ${formatCurrency(
                        marginMeta.unpricedSales
                      )} in sales excluded.`
                    : ''
                }`
              : valuationReport
              ? `${valuationMeta.costMethodNote || 'Valued at quantity-weighted accepted purchase cost.'} ${
                  valuationMeta.unpricedItemCount > 0
                    ? `${valuationMeta.unpricedItemCount} item(s) are excluded from total.`
                    : ''
                }`
              : 'Balances reflect active ledger invoices and bills reduced by posted payments and credit memos.'}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Custom Report Builder */}
      {activeTab === 'builder' && <ReportBuilder notify={notify} role={role} />}

      {/* Sub-Tab 3: Automated Schedules */}
      {activeTab === 'schedules' && <SavedReportSchedulePanel notify={notify} role={role} />}

      {/* Sub-Tab 4: Approval Workflows */}
      {activeTab === 'workflows' && <WorkflowStudio notify={notify} role={role} />}

      {/* Sub-Tab 5: Document & Pipeline Studios */}
      {activeTab === 'studios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="reports-segmented-group" style={{ width: 'fit-content' }}>
            <button
              type="button"
              className={`reports-segmented-btn ${studioSection === 'invoice' ? 'active' : ''}`}
              onClick={() => setStudioSection('invoice')}
            >
              Invoice Template Designer
            </button>
            <button
              type="button"
              className={`reports-segmented-btn ${studioSection === 'pipeline' ? 'active' : ''}`}
              onClick={() => setStudioSection('pipeline')}
            >
              Lead Pipeline Stages Studio
            </button>
          </div>

          {studioSection === 'invoice' ? (
            <InvoiceTemplateDesigner notify={notify} role={role} />
          ) : (
            <LeadPipelineStudio notify={notify} role={role} />
          )}
        </div>
      )}
    </div>
  );
}
