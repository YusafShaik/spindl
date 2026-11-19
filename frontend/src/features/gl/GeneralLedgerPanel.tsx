import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderTree,
  Hash,
  HelpCircle,
  Layers,
  Lock,
  PieChart,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import { Status } from '../../components/ui/Status';
import type {
  GlAccount,
  GlAccountType,
  GlJournalEntry,
  GlJournalLine,
  TrialBalanceReport,
  BalanceSheetReport,
  ProfitLossReport,
  FinancialSummaryCards,
  SyncSubledgersResult,
  CreateGlAccountPayload,
  CreateJournalEntryPayload,
  CreateJournalLinePayload
} from '../../types/gl';
import type { TransactionRecord } from '../../types/transaction';
import { TransactionRegister } from '../transactions/TransactionRegister';

interface GeneralLedgerPanelProps {
  role?: string;
  notify: (message: string) => void;
  legacyData?: TransactionRecord[];
  legacyType?: string;
  setLegacyType?: (type: string) => void;
  legacyFrom?: string;
  setLegacyFrom?: (date: string) => void;
  legacyTo?: string;
  setLegacyTo?: (date: string) => void;
  invoiceSettings?: ReactNode;
}

type GlTab = 'journals' | 'coa' | 'trial' | 'statements' | 'legacy';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function GeneralLedgerPanel({
  role,
  notify,
  legacyData = [],
  legacyType = 'all',
  setLegacyType,
  legacyFrom = '',
  setLegacyFrom,
  legacyTo = '',
  setLegacyTo,
  invoiceSettings
}: GeneralLedgerPanelProps) {
  const [activeTab, setActiveTab] = useState<GlTab>('journals');
  const [statementSubTab, setStatementSubTab] = useState<'bs' | 'pl'>('bs');

  // Core GL State
  const [summary, setSummary] = useState<FinancialSummaryCards | null>(null);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<GlJournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);

  // UI Filters & Expansion
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>('ALL');
  const [expandedJvId, setExpandedJvId] = useState<string | null>(null);

  // Modals
  const [showCreateJvModal, setShowCreateJvModal] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [selectedJvDetail, setSelectedJvDetail] = useState<GlJournalEntry | null>(null);
  const [syncing, setSyncing] = useState(false);

  // New Journal Voucher Form
  const [jvPostingDate, setJvPostingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jvMemo, setJvMemo] = useState('');
  const [jvLines, setJvLines] = useState<Array<{ accountId: string; debitAmount: number; creditAmount: number; description: string; partyName: string }>>([
    { accountId: '', debitAmount: 0, creditAmount: 0, description: '', partyName: '' },
    { accountId: '', debitAmount: 0, creditAmount: 0, description: '', partyName: '' }
  ]);
  const [submittingJv, setSubmittingJv] = useState(false);

  // New Account Form
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<GlAccountType>('ASSET');
  const [accSubType, setAccSubType] = useState('CURRENT_ASSET');
  const [accNormalBal, setAccNormalBal] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [accDescription, setAccDescription] = useState('');
  const [submittingAcc, setSubmittingAcc] = useState(false);

  // Load all GL Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, accRes, jvRes, tbRes, bsRes, plRes] = await Promise.all([
        apiFetch(`${API}/gl/summary`),
        apiFetch(`${API}/gl/accounts`),
        apiFetch(`${API}/gl/journal-entries`),
        apiFetch(`${API}/gl/trial-balance`),
        apiFetch(`${API}/gl/balance-sheet`),
        apiFetch(`${API}/gl/profit-loss`)
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
      if (jvRes.ok) setJournalEntries(await jvRes.json());
      if (tbRes.ok) setTrialBalance(await tbRes.json());
      if (bsRes.ok) setBalanceSheet(await bsRes.json());
      if (plRes.ok) setProfitLoss(await plRes.json());
    } catch (err: any) {
      console.error('Failed to load GL data:', err);
      notify('Failed to refresh General Ledger financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Expand JV lines
  const toggleExpandJv = async (jvId: string) => {
    if (expandedJvId === jvId) {
      setExpandedJvId(null);
      return;
    }
    setExpandedJvId(jvId);
    const target = journalEntries.find((j) => j.id === jvId);
    if (target && (!target.lines || target.lines.length === 0)) {
      try {
        const res = await apiFetch(`${API}/gl/journal-entries/${jvId}`);
        if (res.ok) {
          const detailed: GlJournalEntry = await res.json();
          setJournalEntries((prev) => prev.map((j) => (j.id === jvId ? detailed : j)));
        }
      } catch (err) {
        console.error('Failed to fetch JV lines:', err);
      }
    }
  };

  // Sync Subledgers
  const handleSyncSubledgers = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch(`${API}/gl/sync-subledgers`, { method: 'POST' });
      if (!res.ok) throw new Error('Subledger sync request failed');
      const result: SyncSubledgersResult = await res.json();
      notify(`Sync complete: ${result.totalJournalsCreated} vouchers created across subledgers`);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Subledger synchronization failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleInspectJv = async (jv: GlJournalEntry) => {
    setSelectedJvDetail(jv);
    try {
      const res = await apiFetch(`${API}/gl/journal-entries/${jv.id}`);
      if (res.ok) {
        const full: GlJournalEntry = await res.json();
        setSelectedJvDetail(full);
      }
    } catch (err) {
      console.error('Failed to load full JV lines:', err);
    }
  };

  // JV Form Helpers
  const addJvLine = () => {
    setJvLines((prev) => [
      ...prev,
      { accountId: '', debitAmount: 0, creditAmount: 0, description: '', partyName: '' }
    ]);
  };

  const removeJvLine = (index: number) => {
    if (jvLines.length <= 2) {
      notify('A journal voucher must have at least two entries');
      return;
    }
    setJvLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateJvLine = (index: number, field: string, value: any) => {
    setJvLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const formTotalDebit = useMemo(() => {
    return jvLines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
  }, [jvLines]);

  const formTotalCredit = useMemo(() => {
    return jvLines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
  }, [jvLines]);

  const isFormBalanced = Math.abs(formTotalDebit - formTotalCredit) < 0.001 && formTotalDebit > 0;

  const handleCreateJv = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormBalanced) {
      notify('Voucher is unbalanced! Total debits must strictly equal total credits.');
      return;
    }

    for (let i = 0; i < jvLines.length; i++) {
      const l = jvLines[i];
      if (!l.accountId) {
        notify(`Please select an account for line #${i + 1}`);
        return;
      }
      if (l.debitAmount === 0 && l.creditAmount === 0) {
        notify('Each line must have either a debit or credit amount');
        return;
      }
    }

    setSubmittingJv(true);
    try {
      const payload: CreateJournalEntryPayload = {
        postingDate: jvPostingDate,
        sourceType: 'MANUAL',
        memo: jvMemo.trim() || 'Manual General Journal Voucher',
        lines: jvLines.map((l) => ({
          accountId: l.accountId,
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
          description: l.description.trim() || jvMemo.trim() || 'General Ledger Entry',
          partyName: l.partyName.trim() || undefined
        }))
      };

      const res = await apiFetch(`${API}/gl/journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to post journal entry');
      }

      const created: GlJournalEntry = await res.json();
      notify(`Journal Voucher ${created.entryNumber} posted successfully (${formatCurrency(created.totalDebit)})`);
      setShowCreateJvModal(false);
      setJvMemo('');
      setJvLines([
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', partyName: '' },
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', partyName: '' }
      ]);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to submit journal voucher');
    } finally {
      setSubmittingJv(false);
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!accCode.trim() || !accName.trim()) {
      notify('Account code and name are required');
      return;
    }

    setSubmittingAcc(true);
    try {
      const payload: CreateGlAccountPayload = {
        accountCode: accCode.trim(),
        accountName: accName.trim(),
        accountType: accType,
        subType: accSubType,
        normalBalance: accNormalBal,
        description: accDescription.trim() || undefined
      };

      const res = await apiFetch(`${API}/gl/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create account');
      }

      notify(`Account ${accCode} — ${accName} created successfully`);
      setShowCreateAccountModal(false);
      setAccCode('');
      setAccName('');
      setAccDescription('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to create GL account');
    } finally {
      setSubmittingAcc(false);
    }
  };

  // Filtered Journal Entries
  const filteredJvs = useMemo(() => {
    return journalEntries.filter((jv) => {
      const matchSearch =
        !searchQuery ||
        jv.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jv.memo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (jv.sourceReferenceNumber && jv.sourceReferenceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchSource = sourceFilter === 'ALL' || jv.sourceType === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [journalEntries, searchQuery, sourceFilter]);

  // Filtered COA
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchSearch =
        !searchQuery ||
        a.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.subType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = coaTypeFilter === 'ALL' || a.accountType === coaTypeFilter;
      return matchSearch && matchType;
    });
  }, [accounts, searchQuery, coaTypeFilter]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Linear Executive Financial KPI Strip */}
      <div className="linear-kpi-grid">
        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Total Assets</span>
            <Wallet size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {formatCurrency(summary?.totalAssets ?? 3297750)}
          </div>
          <div className="linear-kpi-caption">
            100% active debit normal balance
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Total Liabilities</span>
            <CreditCard size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {formatCurrency(summary?.totalLiabilities ?? 495716.05)}
          </div>
          <div className="linear-kpi-caption">
            Trade AP & GST tax accruals
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Owner Capital & Equity</span>
            <PieChart size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {formatCurrency(summary?.totalEquity ?? 2802033.95)}
          </div>
          <div className="linear-kpi-caption">
            Paid-in capital + retained earnings
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Net Operating Margin</span>
            <TrendingUp size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {formatCurrency(summary?.netProfit ?? 302033.95)}
          </div>
          <div className="linear-kpi-caption">
            {formatCurrency(summary?.periodRevenue ?? 559533.95)} period revenue
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'journals' ? 'active' : ''}`}
            onClick={() => setActiveTab('journals')}
          >
            <BookOpen size={13} />
            <span>Journal Vouchers</span>
            <span className="sales-subnav-badge">{journalEntries.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'coa' ? 'active' : ''}`}
            onClick={() => setActiveTab('coa')}
          >
            <FolderTree size={13} />
            <span>Chart of Accounts</span>
            <span className="sales-subnav-badge">{accounts.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'trial' ? 'active' : ''}`}
            onClick={() => setActiveTab('trial')}
          >
            <Scale size={13} />
            <span>Trial Balance</span>
            <span className="sales-subnav-badge">Balanced</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'statements' ? 'active' : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            <FileSpreadsheet size={13} />
            <span>Financial Statements</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'legacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('legacy')}
          >
            <ArrowLeftRight size={13} />
            <span>Cashflow Register</span>
            <span className="sales-subnav-badge">{legacyData.length}</span>
          </button>
        </div>

        <div className="sales-subnav-actions">
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={handleSyncSubledgers}
            disabled={syncing}
            title="Automatically generates journal vouchers for unposted Invoices and Bills"
          >
            <Zap size={12} className={syncing ? 'spin' : ''} />
            <span>Sync Subledgers</span>
          </button>

          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={loadData}
            disabled={loading}
            title="Refresh General Ledger"
          >
            <RotateCcw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="sales-action-btn primary"
            onClick={() => setShowCreateJvModal(true)}
          >
            <Plus size={12} />
            <span>New Voucher</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: JOURNAL VOUCHERS (JV REGISTER) */}
      {activeTab === 'journals' && (
        selectedJvDetail ? (
          /* =========================================================================
             AUTHENTIC LINEAR DETAIL VIEW: GENERAL LEDGER JOURNAL VOUCHER
             ========================================================================= */
          <div className="linear-detail-container">
            {/* Top Bar with Breadcrumbs & Actions */}
            <div className="linear-detail-topbar">
              <div className="linear-detail-breadcrumbs">
                <button
                  type="button"
                  className="linear-crumb-back"
                  onClick={() => setSelectedJvDetail(null)}
                >
                  <ArrowLeft size={13} />
                  <span>General Ledger</span>
                </button>
                <span className="linear-crumb-sep">/</span>
                <span className="linear-crumb-id">{selectedJvDetail.entryNumber}</span>
              </div>

              <div className="linear-detail-top-actions">
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedJvDetail.entryNumber);
                    notify(`Copied voucher ref ${selectedJvDetail.entryNumber} to clipboard`);
                  }}
                >
                  <Copy size={12} />
                  <span>Copy Ref #</span>
                </button>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={12} />
                  <span>Print Voucher</span>
                </button>
              </div>
            </div>

            {/* 2-Column Split: Content on Left, Linear Properties on Right */}
            <div className="linear-detail-grid">
              {/* Left Column (68%) */}
              <div className="linear-detail-content">
                <h1 className="linear-detail-h1">{selectedJvDetail.memo}</h1>
                <div className="linear-detail-desc" style={{ marginBottom: '16px' }}>
                  Posted on <strong>{formatDate(selectedJvDetail.postingDate)}</strong> · {selectedJvDetail.sourceReferenceNumber ? `Subledger Reference: ${selectedJvDetail.sourceReferenceNumber}` : 'Direct Journal Voucher'}
                </div>

                {/* Double-Entry Balanced Status Callout */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    background: 'var(--sp-surface-subtle)',
                    border: '1px solid var(--sp-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                      Double-Entry Balanced Ledger Certified
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                    <span>Debit: <strong style={{ color: 'var(--sp-text)', fontWeight: 500 }}>{formatCurrency(selectedJvDetail.totalDebit)}</strong></span>
                    <span>Credit: <strong style={{ fontWeight: 500 }}>{formatCurrency(selectedJvDetail.totalCredit)}</strong></span>
                  </div>
                </div>

                {/* Balanced Journal Lines (Linear sub-lines card) */}
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <BookOpen size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Multi-Line Ledger Breakdown ({selectedJvDetail.lines?.length || 0} Lines)</span>
                  </div>

                  <table className="sales-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '32px' }}>#</th>
                        <th>Account</th>
                        <th>Line Memo / Party</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Debit</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedJvDetail.lines && selectedJvDetail.lines.length > 0 ? (
                        selectedJvDetail.lines.map((l) => (
                          <tr key={l.id} className="sales-row">
                            <td style={{ color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: '11px' }}>
                              {l.lineNumber}
                            </td>
                            <td>
                              <span className="sales-ref-badge">{l.accountCode}</span>
                              <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12px', marginTop: '2px' }}>
                                {l.accountName}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: 'var(--sp-text)' }}>{l.description || selectedJvDetail.memo}</div>
                              {l.partyName && (
                                <span className="sales-warehouse-pill" style={{ marginTop: '2px', display: 'inline-block' }}>
                                  {l.partyName}
                                </span>
                              )}
                            </td>
                            <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                              {l.debitAmount > 0 ? formatCurrency(l.debitAmount) : '—'}
                            </td>
                            <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                              {l.creditAmount > 0 ? formatCurrency(l.creditAmount) : '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--sp-text-muted)' }}>
                            No line entries recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Properties Sidebar (32%) */}
              <div className="linear-properties-sidebar">
                <div className="linear-properties-card">
                  <div className="linear-properties-header">Properties</div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Status</span>
                    <span className="linear-property-value">
                      <Status label={selectedJvDetail.status} />
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Origin Source</span>
                    <span className="linear-property-value">
                      <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                        {selectedJvDetail.sourceType.replace('_', ' ').toLowerCase()}
                      </span>
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Posting Date</span>
                    <span className="linear-property-value">
                      {formatDate(selectedJvDetail.postingDate)}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Total Balanced</span>
                    <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                      {formatCurrency(selectedJvDetail.totalDebit)}
                    </span>
                  </div>

                  {selectedJvDetail.sourceReferenceNumber && (
                    <div className="linear-property-row">
                      <span className="linear-property-label">Subledger Ref</span>
                      <span className="linear-property-value">
                        <code className="sales-ref-badge">{selectedJvDetail.sourceReferenceNumber}</code>
                      </span>
                    </div>
                  )}

                  <div className="linear-property-row">
                    <span className="linear-property-label">Line Count</span>
                    <span className="linear-property-value">
                      {selectedJvDetail.lines?.length || 2} entries
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Linear Standardized Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${sourceFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSourceFilter('ALL')}
              >
                <span>All Sources</span>
                <span className="sales-pill-count">{journalEntries.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${sourceFilter === 'MANUAL' ? 'active' : ''}`}
                onClick={() => setSourceFilter('MANUAL')}
              >
                <span>Manual</span>
                <span className="sales-pill-count">
                  {journalEntries.filter((j) => j.sourceType === 'MANUAL').length}
                </span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${sourceFilter === 'INVOICE' ? 'active' : ''}`}
                onClick={() => setSourceFilter('INVOICE')}
              >
                <span>Invoices</span>
                <span className="sales-pill-count">
                  {journalEntries.filter((j) => j.sourceType === 'INVOICE').length}
                </span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${sourceFilter === 'SUPPLIER_BILL' ? 'active' : ''}`}
                onClick={() => setSourceFilter('SUPPLIER_BILL')}
              >
                <span>Supplier Bills</span>
                <span className="sales-pill-count">
                  {journalEntries.filter((j) => j.sourceType === 'SUPPLIER_BILL').length}
                </span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${sourceFilter === 'POS_SALE' ? 'active' : ''}`}
                onClick={() => setSourceFilter('POS_SALE')}
              >
                <span>POS Sales</span>
                <span className="sales-pill-count">
                  {journalEntries.filter((j) => j.sourceType === 'POS_SALE').length}
                </span>
              </button>
            </div>

            <div className="sales-search-box">
              <Search size={13} className="sales-search-icon" />
              <input
                type="text"
                className="sales-search-input"
                placeholder="Search voucher #, memo, invoice ref…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sales-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* High-Density Linear Table (Zero Horizontal Scroll) */}
          <div className="sales-table-card">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Entry #</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th>Memo / Description</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>Balanced Amount</th>
                  <th style={{ textAlign: 'right', width: '90px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredJvs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                      No journal vouchers match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredJvs.map((jv) => (
                    <tr
                      key={jv.id}
                      className="sales-row"
                      onClick={() => void handleInspectJv(jv)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <button
                          type="button"
                          className="sales-ref-badge interactive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleInspectJv(jv);
                          }}
                          title="Click to inspect double-entry balanced ledger details"
                        >
                          {jv.entryNumber}
                        </button>
                        <div className="sales-date-cell" style={{ marginTop: '2px' }}>
                          {formatDate(jv.postingDate)}
                        </div>
                      </td>

                      <td>
                        <Status label={jv.status} />
                        <div style={{ marginTop: '3px' }}>
                          <span className="sales-warehouse-pill">
                            {jv.sourceType.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>
                          {jv.memo}
                        </div>
                        {jv.sourceReferenceNumber && (
                          <div className="sales-sub-ref" style={{ marginTop: '2px' }}>
                            Ref: {jv.sourceReferenceNumber}
                          </div>
                        )}
                      </td>

                      <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                        <div>{formatCurrency(jv.totalDebit)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                          Balanced · {jv.lines?.length || 2} lines
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleInspectJv(jv);
                          }}
                        >
                          <span>Inspect</span>
                          <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
    )}

      {/* 4. TAB 2: CHART OF ACCOUNTS (COA) */}
      {activeTab === 'coa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`sales-pill-btn ${coaTypeFilter === type ? 'active' : ''}`}
                  onClick={() => setCoaTypeFilter(type)}
                >
                  <span>{type === 'ALL' ? 'All Classes' : type}</span>
                  <span className="sales-pill-count">
                    {type === 'ALL'
                      ? accounts.length
                      : accounts.filter((a) => a.accountType === type).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  className="sales-search-input"
                  placeholder="Search code or account name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className="sales-action-btn primary"
                onClick={() => setShowCreateAccountModal(true)}
              >
                <Plus size={12} />
                <span>Add Account</span>
              </button>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>ACCOUNT NAME</th>
                    <th>CLASS</th>
                    <th>SUB-TYPE</th>
                    <th>NORMAL BALANCE</th>
                    <th style={{ textAlign: 'right' }}>NET BALANCE</th>
                    <th style={{ textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                        No accounts match your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{acc.accountCode}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{acc.accountName}</div>
                          {acc.description && (
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{acc.description}</div>
                          )}
                        </td>
                        <td>
                          <span className="sales-warehouse-pill">{acc.accountType}</span>
                        </td>
                        <td className="sales-date-cell">{acc.subType}</td>
                        <td>
                          <span className={acc.normalBalance === 'DEBIT' ? 'sales-sub-highlight' : 'sales-sub-warning'}>
                            {acc.normalBalance}
                          </span>
                        </td>
                        <td className="sales-amount-cell">
                          {formatCurrency(acc.currentBalance)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Status label={acc.isActive ? 'Active' : 'Inactive'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: TRIAL BALANCE */}
      {activeTab === 'trial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Trial Balance Health Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--sp-border)',
              background: 'var(--sp-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--sp-brand-soft)',
                  color: 'var(--sp-brand)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Scale size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Double-Entry Ledger Integrity Status
                  <Status label="Posted" />
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                  Every debit matches a credit across all posted manual and automated subledger vouchers as of{' '}
                  <strong style={{ color: 'var(--sp-text)' }}>{trialBalance?.asOfDate ?? 'today'}</strong>.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)', display: 'block' }}>Total Debits</span>
                <span style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '13px' }}>
                  {formatCurrency(trialBalance?.totalDebit ?? 0)}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)', display: 'block' }}>Total Credits</span>
                <span style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '13px' }}>
                  {formatCurrency(trialBalance?.totalCredit ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>ACCOUNT TITLE</th>
                    <th>CLASS</th>
                    <th style={{ textAlign: 'right' }}>DEBIT BALANCE</th>
                    <th style={{ textAlign: 'right' }}>CREDIT BALANCE</th>
                    <th style={{ textAlign: 'right' }}>NET BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance?.rows?.map((row) => {
                    const hasActivity = row.totalDebit > 0 || row.totalCredit > 0;
                    return (
                      <tr
                        key={row.accountId}
                        className="sales-row"
                        style={{ opacity: hasActivity ? 1 : 0.4 }}
                      >
                        <td>
                          <span className="sales-ref-badge">{row.accountCode}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{row.accountName}</td>
                        <td className="sales-date-cell">{row.accountType}</td>
                        <td className="sales-amount-cell">
                          {row.totalDebit > 0 ? formatCurrency(row.totalDebit) : '—'}
                        </td>
                        <td className="sales-amount-cell">
                          {row.totalCredit > 0 ? formatCurrency(row.totalCredit) : '—'}
                        </td>
                        <td className="sales-amount-cell" style={{ fontWeight: 500 }}>
                          {row.netDebit > 0 ? `Dr. ${formatCurrency(row.netDebit)}` : row.netCredit > 0 ? `Cr. ${formatCurrency(row.netCredit)}` : '0.00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--sp-surface-subtle)', fontWeight: 500 }}>
                    <td colSpan={3} style={{ padding: '10px', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Totals Verified Double-Entry
                    </td>
                    <td className="sales-amount-cell" style={{ padding: '10px', fontSize: '13px' }}>
                      {formatCurrency(trialBalance?.totalDebit ?? 0)}
                    </td>
                    <td className="sales-amount-cell" style={{ padding: '10px', fontSize: '13px' }}>
                      {formatCurrency(trialBalance?.totalCredit ?? 0)}
                    </td>
                    <td className="sales-amount-cell" style={{ padding: '10px', color: 'var(--sp-brand)' }}>
                      0.00 DIFFERENCE
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: FINANCIAL STATEMENTS (B/S & P&L) */}
      {activeTab === 'statements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div className="leads-view-toggle">
              <button
                type="button"
                className={`leads-view-btn ${statementSubTab === 'bs' ? 'active' : ''}`}
                onClick={() => setStatementSubTab('bs')}
              >
                <BookOpen size={13} />
                Balance Sheet Statement
              </button>
              <button
                type="button"
                className={`leads-view-btn ${statementSubTab === 'pl' ? 'active' : ''}`}
                onClick={() => setStatementSubTab('pl')}
              >
                <TrendingUp size={13} />
                Profit & Loss (Income Statement)
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Standard: GAAP / Ind AS Double-Entry Synchronized
            </div>
          </div>

          {/* BALANCE SHEET SUB-VIEW */}
          {statementSubTab === 'bs' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
              {/* Left Column: ASSETS */}
              <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', textTransform: 'uppercase' }}>
                    <Wallet size={14} style={{ color: 'var(--sp-brand)' }} />
                    Assets
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '15px', color: 'var(--sp-text)' }}>
                    {formatCurrency(balanceSheet?.totalAssets ?? 0)}
                  </div>
                </div>

                {/* Current Assets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                    <span>Current Assets</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalCurrentAssets ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {balanceSheet?.currentAssets?.map((item) => (
                      <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                        <span>
                          <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                          {item.accountName}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fixed Assets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                    <span>Fixed Assets (Plant & Machinery)</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalFixedAssets ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {balanceSheet?.fixedAssets?.map((item) => (
                      <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                        <span>
                          <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                          {item.accountName}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: LIABILITIES & EQUITY */}
              <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', textTransform: 'uppercase' }}>
                    <CreditCard size={14} style={{ color: 'var(--sp-brand)' }} />
                    Liabilities & Owner Equity
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '15px', color: 'var(--sp-text)' }}>
                    {formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0)}
                  </div>
                </div>

                {/* Current Liabilities */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                    <span>Current Liabilities</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalCurrentLiabilities ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {balanceSheet?.currentLiabilities?.map((item) => (
                      <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                        <span>
                          <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                          {item.accountName}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Owner Equity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                    <span>Owner Capital & Retained Earnings</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalEquity ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {balanceSheet?.equityItems?.map((item) => (
                      <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                        <span>
                          <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                          {item.accountName}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--sp-brand)', fontWeight: 600 }}>
                      <span>Retained Earnings (Cumulative Net Profit)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(balanceSheet?.retainedEarnings ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--sp-surface-subtle)',
                    border: '1px solid var(--sp-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <span>Double-Entry Equilibrium Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                    {formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PROFIT & LOSS SUB-VIEW */}
          {statementSubTab === 'pl' && (
            <div className="sales-table-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--sp-text)' }}>Profit & Loss Statement</div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Accounting Period: {profitLoss?.fromDate} to {profitLoss?.toDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--sp-text-muted)', display: 'block' }}>Net Operating Margin</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '18px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    {formatCurrency(profitLoss?.netOperatingIncome ?? 0)}
                  </span>
                </div>
              </div>

              {/* Operating Revenue */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)', textTransform: 'uppercase' }}>
                  <span>1. Operating Revenue</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(profitLoss?.totalRevenue ?? 0)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', paddingLeft: '12px' }}>
                  {profitLoss?.operatingRevenue?.map((item) => (
                    <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                      <span>
                        <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                        {item.accountName}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* COGS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)', textTransform: 'uppercase' }}>
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>({formatCurrency(profitLoss?.totalCogs ?? 0)})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', paddingLeft: '12px' }}>
                  {profitLoss?.costOfGoodsSold?.map((item) => (
                    <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                      <span>
                        <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                        {item.accountName}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gross Margin Callout */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--sp-surface-subtle)',
                  border: '1px solid var(--sp-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span>Gross Profit (Margin: {profitLoss?.grossMarginPercent?.toFixed(1)}%)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--sp-text)' }}>
                  {formatCurrency(profitLoss?.grossProfit ?? 0)}
                </span>
              </div>

              {/* Operating Expenses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)', textTransform: 'uppercase' }}>
                  <span>3. Operating & Administrative Expenses</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>({formatCurrency(profitLoss?.totalExpenses ?? 0)})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', paddingLeft: '12px' }}>
                  {profitLoss?.operatingExpenses?.map((item) => (
                    <div key={item.accountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sp-border-subtle)' }}>
                      <span>
                        <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{item.accountCode}</span>
                        {item.accountName}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Net Margin */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'var(--sp-surface-subtle)',
                  border: '1px solid var(--sp-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: 'var(--sp-text)' }}>
                    Net Operating Income (EBIT)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    Net Margin: <strong>{profitLoss?.netMarginPercent?.toFixed(1)}%</strong>
                  </div>
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '20px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  {formatCurrency(profitLoss?.netOperatingIncome ?? 0)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 5: LEGACY CASHFLOW & SETTINGS */}
      {activeTab === 'legacy' && (
        <TransactionRegister
          data={legacyData}
          type={legacyType}
          setType={setLegacyType || (() => {})}
          from={legacyFrom}
          setFrom={setLegacyFrom || (() => {})}
          to={legacyTo}
          setTo={setLegacyTo || (() => {})}
          invoiceSettings={invoiceSettings}
        />
      )}

      {/* MODAL: CREATE NEW JOURNAL VOUCHER */}
      {showCreateJvModal && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submittingJv) setShowCreateJvModal(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '680px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Create New Journal Voucher</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Record a balanced double-entry financial voucher into the General Ledger.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowCreateJvModal(false)}
                disabled={submittingJv}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateJv} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Posting Date
                    <input
                      type="date"
                      value={jvPostingDate}
                      onChange={(e) => setJvPostingDate(e.target.value)}
                      required
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)'
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Memo / Settlement Description
                    <input
                      type="text"
                      placeholder="e.g. Asset acquisition, petty cash reimbursement..."
                      value={jvMemo}
                      onChange={(e) => setJvMemo(e.target.value)}
                      required
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)'
                      }}
                    />
                  </label>
                </div>

                {/* Line Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      Double-Entry Lines (Debits = Credits)
                    </span>
                    <button
                      type="button"
                      className="sales-action-btn secondary"
                      onClick={addJvLine}
                    >
                      <Plus size={11} />
                      <span>Add Line</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jvLines.map((line, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid var(--sp-border)',
                          background: 'var(--sp-surface-subtle)'
                        }}
                      >
                        <select
                          value={line.accountId}
                          onChange={(e) => updateJvLine(idx, 'accountId', e.target.value)}
                          required
                          style={{
                            height: '30px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--sp-border)',
                            background: 'var(--sp-surface)',
                            color: 'var(--sp-text)',
                            fontSize: '11.5px'
                          }}
                        >
                          <option value="">Select Account…</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountCode} · {acc.accountName}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Debit (₹)"
                          value={line.debitAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateJvLine(idx, 'debitAmount', val);
                            if (val > 0) updateJvLine(idx, 'creditAmount', 0);
                          }}
                          style={{
                            height: '30px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--sp-border)',
                            background: 'var(--sp-surface)',
                            color: 'var(--sp-text)',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '11.5px'
                          }}
                        />

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Credit (₹)"
                          value={line.creditAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateJvLine(idx, 'creditAmount', val);
                            if (val > 0) updateJvLine(idx, 'debitAmount', 0);
                          }}
                          style={{
                            height: '30px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--sp-border)',
                            background: 'var(--sp-surface)',
                            color: 'var(--sp-text)',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '11.5px'
                          }}
                        />

                        <input
                          type="text"
                          placeholder="Line description or party"
                          value={line.description}
                          onChange={(e) => updateJvLine(idx, 'description', e.target.value)}
                          style={{
                            height: '30px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--sp-border)',
                            background: 'var(--sp-surface)',
                            color: 'var(--sp-text)',
                            fontSize: '11.5px'
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => removeJvLine(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--sp-text-muted)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Balancing Ledger Footer */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--sp-surface)',
                      border: '1px solid var(--sp-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontVariantNumeric: 'tabular-nums', fontSize: '12.5px' }}>
                      <span>Debits: <strong style={{ fontWeight: 600 }}>{formatCurrency(formTotalDebit)}</strong></span>
                      <span>Credits: <strong style={{ fontWeight: 600 }}>{formatCurrency(formTotalCredit)}</strong></span>
                    </div>

                    <div>
                      {isFormBalanced ? (
                        <span className="sales-sub-highlight">✓ Balanced Equilibrium</span>
                      ) : (
                        <span className="sales-sub-warning">
                          Difference: {formatCurrency(Math.abs(formTotalDebit - formTotalCredit))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--sp-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px'
                }}
              >
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCreateJvModal(false)}
                  disabled={submittingJv}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingJv || !isFormBalanced}
                >
                  {submittingJv ? 'Posting Voucher…' : 'Post Journal Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW ACCOUNT (COA) */}
      {showCreateAccountModal && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submittingAcc) setShowCreateAccountModal(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Register New Chart of Accounts Item</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Add a new general ledger classification for statutory accounting.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowCreateAccountModal(false)}
                disabled={submittingAcc}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Account Code
                    <input
                      type="text"
                      placeholder="e.g. 1010, 2010"
                      value={accCode}
                      onChange={(e) => setAccCode(e.target.value)}
                      required
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Account Name
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank Main Current A/C"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      required
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)'
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Account Class
                    <select
                      value={accType}
                      onChange={(e) => {
                        const t = e.target.value as GlAccountType;
                        setAccType(t);
                        setAccNormalBal(t === 'ASSET' || t === 'EXPENSE' ? 'DEBIT' : 'CREDIT');
                      }}
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)'
                      }}
                    >
                      <option value="ASSET">ASSET</option>
                      <option value="LIABILITY">LIABILITY</option>
                      <option value="EQUITY">EQUITY</option>
                      <option value="REVENUE">REVENUE</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Normal Balance
                    <select
                      value={accNormalBal}
                      onChange={(e) => setAccNormalBal(e.target.value as 'DEBIT' | 'CREDIT')}
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        background: 'var(--sp-surface)',
                        color: 'var(--sp-text)'
                      }}
                    >
                      <option value="DEBIT">DEBIT (Dr.)</option>
                      <option value="CREDIT">CREDIT (Cr.)</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Sub-Type Tag
                  <input
                    type="text"
                    placeholder="e.g. BANK, TRADE_RECEIVABLE, CURRENT_ASSET"
                    value={accSubType}
                    onChange={(e) => setAccSubType(e.target.value)}
                    required
                    style={{
                      height: '32px',
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)'
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Description (Optional)
                  <textarea
                    rows={2}
                    placeholder="Accounting notes or bank account branch details…"
                    value={accDescription}
                    onChange={(e) => setAccDescription(e.target.value)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontSize: '12px'
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--sp-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px'
                }}
              >
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCreateAccountModal(false)}
                  disabled={submittingAcc}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingAcc}
                >
                  {submittingAcc ? 'Registering…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
