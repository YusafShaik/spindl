import { useState, useMemo, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Download,
  FileText,
  Filter,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-react';
import { TransactionTable } from '../../components/ui/TransactionTable';
import { formatCurrency } from '../../lib/utils/currency';
import type { TransactionRecord } from '../../types/transaction';

interface TransactionRegisterProps {
  data: TransactionRecord[];
  type: string;
  setType: (type: string) => void;
  from: string;
  setFrom: (date: string) => void;
  to: string;
  setTo: (date: string) => void;
  invoiceSettings: ReactNode;
}

type RegisterTab = 'all' | 'receivables' | 'payables' | 'tax';
type QuickPill = 'ALL' | 'INVOICE' | 'BILL' | 'PAYMENT' | 'CREDIT';

export function TransactionRegister({
  data,
  type,
  setType,
  from,
  setFrom,
  to,
  setTo,
  invoiceSettings
}: TransactionRegisterProps) {
  const [activeTab, setActiveTab] = useState<RegisterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickPill, setQuickPill] = useState<QuickPill>('ALL');

  // Executive Financial KPI Calculations
  const { totalInflow, totalOutflow, netCashFlow, arCount, apCount, cashInTotal, cashOutTotal } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let cashIn = 0;
    let cashOut = 0;
    let ar = 0;
    let ap = 0;

    for (const tx of data) {
      const amt = Number(tx.amount || 0);
      const dir = (tx.direction || '').toUpperCase();
      const t = tx.type;

      if (dir === 'RECEIVABLE' || dir === 'CASH_IN' || t === 'SALES_INVOICE' || t === 'CUSTOMER_PAYMENT') {
        inflow += amt;
        ar++;
        if (dir === 'CASH_IN' || t === 'CUSTOMER_PAYMENT') {
          cashIn += amt;
        }
      } else if (dir === 'PAYABLE' || dir === 'CASH_OUT' || t === 'SUPPLIER_BILL' || t === 'SUPPLIER_PAYMENT') {
        outflow += amt;
        ap++;
        if (dir === 'CASH_OUT' || t === 'SUPPLIER_PAYMENT') {
          cashOut += amt;
        }
      } else if (dir === 'CREDIT') {
        if (t === 'CUSTOMER_CREDIT') {
          ar++;
        } else {
          ap++;
        }
      }
    }

    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netCashFlow: cashIn - cashOut,
      arCount: ar,
      apCount: ap,
      cashInTotal: cashIn,
      cashOutTotal: cashOut
    };
  }, [data]);

  // Tab-filtered transactions
  const tabFilteredData = useMemo(() => {
    return data.filter((row) => {
      const dir = (row.direction || '').toUpperCase();
      const t = row.type;

      if (activeTab === 'receivables') {
        return (
          t === 'SALES_INVOICE' ||
          t === 'CUSTOMER_PAYMENT' ||
          t === 'CUSTOMER_CREDIT' ||
          t === 'CUSTOMER_REFUND' ||
          dir === 'RECEIVABLE' ||
          dir === 'CASH_IN'
        );
      }

      if (activeTab === 'payables') {
        return (
          t === 'SUPPLIER_BILL' ||
          t === 'SUPPLIER_PAYMENT' ||
          t === 'SUPPLIER_CREDIT' ||
          dir === 'PAYABLE' ||
          dir === 'CASH_OUT'
        );
      }

      return true;
    });
  }, [data, activeTab]);

  // Export current transactions to CSV
  const exportLedgerCSV = () => {
    const headers = ['Reference', 'Counterparty', 'Type', 'Direction', 'Amount', 'Status', 'Method', 'Occurred At'];
    const rows = tabFilteredData.map((t) => [
      `"${t.reference}"`,
      `"${t.counterparty.replace(/"/g, '""')}"`,
      t.type,
      t.direction,
      t.amount,
      t.status,
      t.method || 'Standard',
      t.occurredAt
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `spindl-general-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setQuickPill('ALL');
    setType('ALL');
    setFrom('');
    setTo('');
  };

  const hasActiveFilters = Boolean(searchQuery || quickPill !== 'ALL' || type !== 'ALL' || from || to);

  return (
    <div className="sales-screen-layout">
      {/* 1. Linear Executive Financial KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">RECEIVABLES & CASH-IN</span>
            <ArrowUpRight size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalInflow)}
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{formatCurrency(cashInTotal)} settled</span> · {arCount} customer events
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">PAYABLES & DISBURSEMENTS</span>
            <ArrowDownLeft size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalOutflow)}
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{formatCurrency(cashOutTotal)} paid</span> · {apCount} supplier events
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">NET SETTLED CASH FLOW</span>
            <Wallet size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div
            className="sales-metric-val"
            style={{
              color: netCashFlow >= 0 ? 'var(--sp-text)' : '#dc2626',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Realized bank cash</span> · Receipts vs disbursements
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">STATUTORY TAX ACCRUALS</span>
            <Receipt size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ₹ 3,900.05
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">GST18 @ 18%</span> · Invoiced tax snapshot
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <ArrowLeftRight size={14} />
            <span>All Ledger Activity</span>
            <span className="sales-subnav-badge">{data.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'receivables' ? 'active' : ''}`}
            onClick={() => setActiveTab('receivables')}
          >
            <ArrowUpRight size={14} />
            <span>Customer Receivables (AR)</span>
            <span className="sales-subnav-badge">{arCount}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'payables' ? 'active' : ''}`}
            onClick={() => setActiveTab('payables')}
          >
            <ArrowDownLeft size={14} />
            <span>Supplier Payables (AP)</span>
            <span className="sales-subnav-badge">{apCount}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'tax' ? 'active' : ''}`}
            onClick={() => setActiveTab('tax')}
          >
            <SlidersHorizontal size={14} />
            <span>Tax Summary & Invoicing Setup</span>
          </button>
        </div>
      </div>

      {/* 3. Dynamic Search & Filters Toolbar */}
      {activeTab !== 'tax' && (
        <div className="sales-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="sales-pill-group">
            <button
              type="button"
              className={`sales-pill-btn ${quickPill === 'ALL' ? 'active' : ''}`}
              onClick={() => setQuickPill('ALL')}
            >
              All <span className="sales-pill-count">{tabFilteredData.length}</span>
            </button>

            {activeTab !== 'payables' && (
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'INVOICE' ? 'active' : ''}`}
                onClick={() => setQuickPill('INVOICE')}
              >
                Invoices{' '}
                <span className="sales-pill-count">
                  {tabFilteredData.filter((t) => t.type === 'SALES_INVOICE').length}
                </span>
              </button>
            )}

            {activeTab !== 'receivables' && (
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'BILL' ? 'active' : ''}`}
                onClick={() => setQuickPill('BILL')}
              >
                Supplier Bills{' '}
                <span className="sales-pill-count">
                  {tabFilteredData.filter((t) => t.type === 'SUPPLIER_BILL').length}
                </span>
              </button>
            )}

            <button
              type="button"
              className={`sales-pill-btn ${quickPill === 'PAYMENT' ? 'active' : ''}`}
              onClick={() => setQuickPill('PAYMENT')}
            >
              Payments{' '}
              <span className="sales-pill-count">
                {tabFilteredData.filter((t) => t.type.includes('PAYMENT') || Boolean(t.method)).length}
              </span>
            </button>

            <button
              type="button"
              className={`sales-pill-btn ${quickPill === 'CREDIT' ? 'active' : ''}`}
              onClick={() => setQuickPill('CREDIT')}
            >
              Credits{' '}
              <span className="sales-pill-count">
                {tabFilteredData.filter((t) => t.type.includes('CREDIT')).length}
              </span>
            </button>
          </div>

          {/* Right controls: dates, search, export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              From:
              <input
                type="date"
                className="tx-date-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              To:
              <input
                type="date"
                className="tx-date-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                className="sales-action-btn ghost"
                onClick={resetAllFilters}
                title="Clear all search queries and date filters"
                style={{ height: '30px' }}
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder={
                  activeTab === 'receivables'
                    ? 'Search receivables…'
                    : activeTab === 'payables'
                    ? 'Search payables…'
                    : 'Search reference, counterparty…'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="sales-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              ) : (
                <kbd className="sales-search-kbd">/</kbd>
              )}
            </div>

            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={exportLedgerCSV}
              title="Download full filtered ledger transactions"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Active Sub-Tab Content */}

      {/* Tabs 1, 2, 3: Transactions Data Table */}
      {activeTab !== 'tax' && (
        <div className="sales-table-card">
          <TransactionTable
            query={searchQuery}
            transactions={tabFilteredData}
            typeFilter={quickPill}
          />
        </div>
      )}

      {/* Tab 4: Tax Summary & Invoicing Setup */}
      {activeTab === 'tax' && invoiceSettings}

      {/* 5. ERP Financial Invariants Banner */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot"></span>
            ERP Double-Entry General Ledger & Invoicing Standard
          </div>
          <div className="sales-pipeline-tag">Strict Double-Entry General Ledger Invariants</div>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Invoice / Bill</b>
              <span>Accounts receivable or payable recognized from order flow</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Tax Snapshot</b>
              <span>Statutory GST / VAT rate locked immutably at issuance</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Settlement</b>
              <span>Bank transfer, RTGS, or UPI payment posts cash entry</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Credit / Refund</b>
              <span>Return debit or customer refund reconciles balance</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Tax Period Filing</b>
              <span>Monthly summary closed and exported for compliance</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
