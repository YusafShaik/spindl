import { useEffect, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';

type ReportKind = 'receivables' | 'payables' | 'margins' | 'inventory-valuation';
type MoneyValue = number | string;

interface AgingRow {
  reference: string; counterparty: string; dueDate: string;
  originalAmount: MoneyValue; paidOrCredited: MoneyValue; balance: MoneyValue; ageBucket: string;
}
interface MarginRow {
  period: string; sku: string; itemName: string; netUnits: number; netSales: MoneyValue;
  estimatedCostOfGoods: MoneyValue; estimatedGrossMargin: MoneyValue; marginPercent: MoneyValue;
}
interface ValuationRow {
  sku: string; itemName: string; onHand: number;
  weightedAveragePurchaseCost: MoneyValue | null; estimatedValue: MoneyValue | null;
}
interface MarginReport {
  rows: MarginRow[]; unpricedItemCount: number; unpricedSales: MoneyValue; costMethodNote: string;
}
interface ValuationReport {
  rows: ValuationRow[]; estimatedTotalValue: MoneyValue; unpricedItemCount: number;
  unpricedUnits: number; costMethodNote: string;
}
interface OperationalReportsProps {
  notify: (message: string) => void;
  role?: string;
  enhancements?: ReactNode;
}

function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isReportKind(value: string): value is ReportKind { return ['receivables', 'payables', 'margins', 'inventory-valuation'].includes(value); }
function isMoney(value: unknown): value is MoneyValue { return typeof value === 'number' || typeof value === 'string'; }
function isAgingRow(value: unknown): value is AgingRow {
  return isRecord(value) && typeof value.reference === 'string' && typeof value.counterparty === 'string' && typeof value.dueDate === 'string' && typeof value.ageBucket === 'string' && isMoney(value.originalAmount) && isMoney(value.paidOrCredited) && isMoney(value.balance);
}
function isAgingRows(value: unknown): value is AgingRow[] {
  return Array.isArray(value) && value.every(isAgingRow);
}
function isMarginRow(value: unknown): value is MarginRow {
  return isRecord(value) && typeof value.period === 'string' && typeof value.sku === 'string' && typeof value.itemName === 'string' && typeof value.netUnits === 'number' && isMoney(value.netSales) && isMoney(value.estimatedCostOfGoods) && isMoney(value.estimatedGrossMargin) && isMoney(value.marginPercent);
}
function isValuationRow(value: unknown): value is ValuationRow {
  return isRecord(value) && typeof value.sku === 'string' && typeof value.itemName === 'string' && typeof value.onHand === 'number' && (value.weightedAveragePurchaseCost === null || isMoney(value.weightedAveragePurchaseCost)) && (value.estimatedValue === null || isMoney(value.estimatedValue));
}
function isMarginReport(value: unknown): value is MarginReport {
  return isRecord(value) && Array.isArray(value.rows) && value.rows.every(isMarginRow) && typeof value.unpricedItemCount === 'number' && isMoney(value.unpricedSales) && typeof value.costMethodNote === 'string';
}
function isValuationReport(value: unknown): value is ValuationReport {
  return isRecord(value) && Array.isArray(value.rows) && value.rows.every(isValuationRow) && isMoney(value.estimatedTotalValue) && typeof value.unpricedItemCount === 'number' && typeof value.unpricedUnits === 'number' && typeof value.costMethodNote === 'string';
}

export function OperationalReports({ notify, role, enhancements }: OperationalReportsProps) {
  const [kind, setKind] = useState<ReportKind>('receivables');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);
  const [marginRows, setMarginRows] = useState<MarginRow[]>([]);
  const [valuationRows, setValuationRows] = useState<ValuationRow[]>([]);
  const [marginMeta, setMarginMeta] = useState({ unpricedItemCount: 0, unpricedSales: 0 as MoneyValue, costMethodNote: '' });
  const [valuationMeta, setValuationMeta] = useState({ estimatedTotalValue: 0 as MoneyValue, unpricedItemCount: 0, unpricedUnits: 0, costMethodNote: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const marginReport = kind === 'margins';
  const valuationReport = kind === 'inventory-valuation';
  const costingReport = marginReport || valuationReport;
  const rows = marginReport ? marginRows : valuationReport ? valuationRows : agingRows;

  useEffect(() => {
    let current = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (from && !valuationReport) params.set(costingReport ? 'from' : 'dueFrom', from);
    if (to && !valuationReport) params.set(costingReport ? 'to' : 'dueTo', to);
    apiFetch(`${API}/reports/${kind}?${params}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load this report')))
      .then((data: unknown) => {
        if (!current) return;
        if (kind === 'margins') {
          if (!isMarginReport(data)) throw new Error('Invalid sales margin report response');
          const report = data;
          setMarginRows(report.rows || []);
          setMarginMeta({ unpricedItemCount: report.unpricedItemCount || 0, unpricedSales: report.unpricedSales || 0, costMethodNote: report.costMethodNote || '' });
          setValuationMeta({ estimatedTotalValue: 0, unpricedItemCount: 0, unpricedUnits: 0, costMethodNote: '' });
        } else if (kind === 'inventory-valuation') {
          if (!isValuationReport(data)) throw new Error('Invalid inventory valuation report response');
          const report = data;
          setValuationRows(report.rows || []);
          setValuationMeta({ estimatedTotalValue: report.estimatedTotalValue || 0, unpricedItemCount: report.unpricedItemCount || 0, unpricedUnits: report.unpricedUnits || 0, costMethodNote: report.costMethodNote || '' });
          setMarginMeta({ unpricedItemCount: 0, unpricedSales: 0, costMethodNote: '' });
        } else {
          if (!isAgingRows(data)) throw new Error('Invalid account aging report response');
          setAgingRows(data);
          setMarginMeta({ unpricedItemCount: 0, unpricedSales: 0, costMethodNote: '' });
          setValuationMeta({ estimatedTotalValue: 0, unpricedItemCount: 0, unpricedUnits: 0, costMethodNote: '' });
        }
      })
      .catch((error: unknown) => { if (current) notify(messageFrom(error)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [kind, from, to]);

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
    } catch (error) { notify(messageFrom(error)); }
    finally { setExporting(false); }
  };

  const total = agingRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const netSales = marginRows.reduce((sum, row) => sum + Number(row.netSales || 0), 0);
  const estimatedCogs = marginRows.reduce((sum, row) => sum + Number(row.estimatedCostOfGoods || 0), 0);
  const estimatedMargin = netSales - estimatedCogs;
  const title = kind === 'receivables' ? 'Accounts receivable' : kind === 'payables' ? 'Accounts payable' : 'Estimated gross margin';
  const canExport = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');

  return <div className="report-layout"><section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Operational reports</h2><p>{marginReport ? 'Review item-level sales, estimated cost and gross margin.' : valuationReport ? 'Review estimated on-hand stock value by item.' : 'Review open customer and supplier balances by due date.'}</p></div><button className="button button-secondary" disabled={exporting || !canExport} onClick={() => void exportCsv()}><Download size={14}/>{exporting ? 'Exporting…' : 'Export CSV'}</button></div>
    <div className="transaction-filters"><label>Report<select value={kind} onChange={(event) => { if (isReportKind(event.target.value)) setKind(event.target.value); }}><option value="receivables">Accounts receivable</option><option value="payables">Accounts payable</option><option value="margins">Sales margin by item</option><option value="inventory-valuation">Inventory valuation</option></select></label>{!valuationReport && <><label>{costingReport ? 'From' : 'Due from'}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label>{costingReport ? 'To' : 'Due to'}<input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label><button className="filter-button" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button></>}</div>
    {marginReport ? <><div className="report-summary"><div><small>Priced net sales</small><b>{formatCurrency(netSales)}</b></div><div><small>Estimated COGS</small><b>{formatCurrency(estimatedCogs)}</b></div><div><small>Gross margin on priced items</small><b>{formatCurrency(estimatedMargin)}</b></div></div><p className="form-note">{marginMeta.costMethodNote} {marginMeta.unpricedItemCount > 0 && `${marginMeta.unpricedItemCount} item(s) lack cost history; ${formatCurrency(marginMeta.unpricedSales)} in sales are excluded.`}</p></> : valuationReport ? <><div className="report-summary"><div><small>Estimated inventory value</small><b>{formatCurrency(valuationMeta.estimatedTotalValue)}</b></div><div><small>Active items</small><b>{valuationRows.length}</b></div><div><small>Units without cost history</small><b>{valuationMeta.unpricedUnits.toLocaleString()}</b></div></div><p className="form-note">{valuationMeta.costMethodNote} {valuationMeta.unpricedItemCount > 0 && `${valuationMeta.unpricedItemCount} item(s) are not included in the total.`}</p></> : <div className="report-summary"><div><small>{title}</small><b>{formatCurrency(total)}</b></div><div><small>Open records</small><b>{agingRows.length}</b></div><div><small>Over 30 days overdue</small><b>{agingRows.filter((row) => ['31-60_DAYS', '61-90_DAYS', 'OVER_90_DAYS'].includes(row.ageBucket)).length}</b></div></div>}
    <div className="table-scroll"><table><thead>{marginReport ? <tr><th>PERIOD</th><th>SKU</th><th>ITEM</th><th>NET UNITS</th><th>NET SALES</th><th>EST. COGS</th><th>GROSS MARGIN</th><th>MARGIN</th></tr> : valuationReport ? <tr><th>SKU</th><th>ITEM</th><th>ON HAND</th><th>WEIGHTED AVG. COST</th><th>EST. STOCK VALUE</th></tr> : <tr><th>REFERENCE</th><th>CUSTOMER / SUPPLIER</th><th>DUE DATE</th><th>AGE</th><th>ORIGINAL</th><th>PAID / CREDITED</th><th>OPEN BALANCE</th></tr>}</thead><tbody>
      {loading ? <tr><td className="empty-cell" colSpan={8}>Loading report…</td></tr> : marginReport ? marginRows.length ? marginRows.map((row, index) => <tr key={`${row.period}-${row.sku}-${index}`}><td>{row.period}</td><td className="ref-cell">{row.sku}</td><td>{row.itemName}</td><td>{row.netUnits}</td><td>{formatCurrency(row.netSales)}</td><td>{formatCurrency(row.estimatedCostOfGoods)}</td><td className="amount-cell">{formatCurrency(row.estimatedGrossMargin)}</td><td>{row.marginPercent}%</td></tr>) : <tr><td className="empty-cell" colSpan={8}>No records match the selected filters.</td></tr> : valuationReport ? valuationRows.length ? valuationRows.map((row) => <tr key={row.sku}><td className="ref-cell">{row.sku}</td><td>{row.itemName}</td><td>{row.onHand}</td><td>{row.weightedAveragePurchaseCost == null ? 'No purchase history' : formatCurrency(row.weightedAveragePurchaseCost)}</td><td className="amount-cell">{row.estimatedValue == null ? '—' : formatCurrency(row.estimatedValue)}</td></tr>) : <tr><td className="empty-cell" colSpan={8}>No records match the selected filters.</td></tr> : agingRows.length ? agingRows.map((row) => <tr key={row.reference}><td className="ref-cell">{row.reference}</td><td>{row.counterparty}</td><td className="date-cell">{row.dueDate}</td><td><Status label={row.ageBucket.replaceAll('_', ' ').toLowerCase()}/></td><td>{formatCurrency(row.originalAmount)}</td><td>{formatCurrency(row.paidOrCredited)}</td><td className="amount-cell">{formatCurrency(row.balance)}</td></tr>) : <tr><td className="empty-cell" colSpan={8}>No records match the selected filters.</td></tr>}
    </tbody></table></div></section>{enhancements}</div>;
}
