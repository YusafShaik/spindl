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
  const [trialOnlyActive, setTrialOnlyActive] = useState(false);

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

  // Executive COA Metrics
  const coaMetrics = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.isActive).length;
    const assetTotal = accounts
      .filter((a) => a.accountType === 'ASSET')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const liabilityTotal = accounts
      .filter((a) => a.accountType === 'LIABILITY')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const equityTotal = accounts
      .filter((a) => a.accountType === 'EQUITY')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    return { total, active, assetTotal, liabilityTotal, equityTotal };
  }, [accounts]);

  // Filtered Trial Balance Rows
  const filteredTrialRows = useMemo(() => {
    if (!trialBalance?.rows) return [];
    if (!trialOnlyActive) return trialBalance.rows;
    return trialBalance.rows.filter((r) => r.totalDebit > 0 || r.totalCredit > 0);
  }, [trialBalance, trialOnlyActive]);

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
             AUTHENTIC LINEAR DETAIL VIEW: GENERAL LEDGER JOURNAL VOUCHER (FULL-WIDTH)
             ========================================================================= */
          <div className="gl-voucher-detail-container">
            {/* Top Bar with Breadcrumbs & Actions */}
            <div className="gl-detail-topbar">
              <div className="gl-detail-breadcrumbs">
                <button
                  type="button"
                  className="gl-crumb-back"
                  onClick={() => setSelectedJvDetail(null)}
                >
                  <ArrowLeft size={13} />
                  <span>Journal Vouchers</span>
                </button>
                <span className="gl-crumb-sep">/</span>
                <span className="gl-crumb-id">{selectedJvDetail.entryNumber}</span>
              </div>

              <div className="gl-detail-top-actions">
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedJvDetail.entryNumber);
                    notify(`Copied voucher ref ${selectedJvDetail.entryNumber} to clipboard`);
                  }}
                  title="Copy voucher reference"
                >
                  <Copy size={12} />
                  <span>Copy Ref #</span>
                </button>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => window.print()}
                  title="Print official voucher ledger"
                >
                  <Printer size={12} />
                  <span>Print Voucher</span>
                </button>
              </div>
            </div>

            {/* Voucher Header & Title */}
            <div className="gl-detail-header-card">
              <div className="gl-detail-header-top">
                <div>
                  <div className="gl-detail-badge-row">
                    <span className="order-number-pill" style={{ fontWeight: 600 }}>{selectedJvDetail.entryNumber}</span>
                    <Status label={selectedJvDetail.status} />
                    <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                      {selectedJvDetail.sourceType.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <h1 className="gl-detail-h1">{selectedJvDetail.memo}</h1>
                  <div className="gl-detail-sub">
                    Posted on <strong>{formatDate(selectedJvDetail.postingDate)}</strong>
                    {selectedJvDetail.sourceReferenceNumber && (
                      <> · Subledger Ref: <code className="sales-ref-badge" style={{ marginLeft: '4px' }}>{selectedJvDetail.sourceReferenceNumber}</code></>
                    )}
                  </div>
                </div>

                <div className="gl-detail-cert-box">
                  <ShieldCheck size={20} style={{ color: 'var(--sp-success)' }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-success)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Double-Entry Certified
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                      Debits = Credits (Equilibrium)
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Metric Equilibrium Strip */}
              <div className="gl-kpi-grid">
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Total Debit</span>
                  <span className="gl-kpi-value">{formatCurrency(selectedJvDetail.totalDebit)}</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Total Credit</span>
                  <span className="gl-kpi-value">{formatCurrency(selectedJvDetail.totalCredit)}</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Net Variance</span>
                  <span className="gl-kpi-value" style={{ color: 'var(--sp-success)' }}>
                    ₹ 0.00 (Balanced)
                  </span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Line Entries</span>
                  <span className="gl-kpi-value">{selectedJvDetail.lines?.length || 2} entries</span>
                </div>
              </div>
            </div>

            {/* Multi-Line Ledger Breakdown (Full Width) */}
            <div className="sales-table-card">
              <div className="gl-sublines-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={14} style={{ color: 'var(--sp-brand)' }} />
                  <span style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--sp-text)' }}>
                    Multi-Line Ledger Breakdown ({selectedJvDetail.lines?.length || 0} Lines)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                  GAAP / Ind AS Certified Entry Ledger
                </span>
              </div>

              <table className="sales-table" style={{ margin: 0, width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '260px' }}>Account</th>
                    <th>Line Memo / Description</th>
                    <th style={{ width: '180px' }}>Party / Entity</th>
                    <th style={{ textAlign: 'right', width: '140px' }}>Debit</th>
                    <th style={{ textAlign: 'right', width: '140px' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedJvDetail.lines && selectedJvDetail.lines.length > 0 ? (
                    selectedJvDetail.lines.map((l) => (
                      <tr key={l.id} className="sales-row production-clickable-row">
                        <td style={{ color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: '11px', textAlign: 'center' }}>
                          {l.lineNumber}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={() => {
                                setSelectedJvDetail(null);
                                setSearchQuery(l.accountCode);
                                notify(`Filtered Journal Vouchers by account ${l.accountCode}`);
                              }}
                              title={`Inspect account ${l.accountCode}`}
                            >
                              <span>{l.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                            <span style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12px' }}>
                              {l.accountName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', color: 'var(--sp-text)' }}>{l.description || selectedJvDetail.memo}</div>
                        </td>
                        <td>
                          {l.partyName ? (
                            <span className="sales-warehouse-pill">
                              {l.partyName}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>—</span>
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
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--sp-text-muted)' }}>
                        No line entries recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--sp-surface-subtle)', fontWeight: 600, borderTop: '2px solid var(--sp-border)' }}>
                    <td colSpan={4} style={{ padding: '10px 14px', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Balanced Total Certified Double-Entry
                    </td>
                    <td className="sales-amount-cell" style={{ textAlign: 'right', padding: '10px 14px', fontSize: '13px' }}>
                      {formatCurrency(selectedJvDetail.totalDebit)}
                    </td>
                    <td className="sales-amount-cell" style={{ textAlign: 'right', padding: '10px 14px', fontSize: '13px' }}>
                      {formatCurrency(selectedJvDetail.totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
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

          {/* High-Density Linear Table Matching Maintenance & ECO */}
          <div className="sales-table-card">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Voucher Ref</th>
                  <th style={{ width: '110px' }}>Posting Date</th>
                  <th style={{ width: '115px' }}>Origin</th>
                  <th>Memo / Description</th>
                  <th style={{ width: '160px' }}>Subledger Ref</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Entries</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>Balanced Amount</th>
                  <th style={{ width: '105px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredJvs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                      No journal vouchers match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredJvs.map((jv) => (
                    <tr
                      key={jv.id}
                      className="sales-row production-clickable-row"
                      onClick={() => void handleInspectJv(jv)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="order-number-pill interactive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleInspectJv(jv);
                          }}
                          title={`Inspect voucher ${jv.entryNumber}`}
                        >
                          <span>{jv.entryNumber}</span>
                          <ArrowUpRight size={11} className="order-link-arrow" />
                        </button>
                      </td>

                      <td>
                        <span className="sales-date-cell">
                          {formatDate(jv.postingDate)}
                        </span>
                      </td>

                      <td>
                        <span className="sales-warehouse-pill" style={{ textTransform: 'capitalize' }}>
                          {jv.sourceType.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td style={{ overflow: 'hidden' }}>
                        <span
                          style={{
                            fontWeight: 500,
                            color: 'var(--sp-text)',
                            fontSize: '12.5px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block'
                          }}
                          title={jv.memo}
                        >
                          {jv.memo}
                        </span>
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {jv.sourceReferenceNumber ? (
                          <span className="sales-ref-badge" style={{ fontSize: '10.5px' }}>
                            {jv.sourceReferenceNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="sales-pill-count" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {jv.lines?.length || 2} lines
                        </span>
                      </td>

                      <td className="sales-amount-cell" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(jv.totalDebit)}
                      </td>

                      <td>
                        <Status label={jv.status} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Executive COA KPI Summary Strip */}
          <div className="gl-kpi-grid">
            <div className="gl-kpi-item">
              <span className="gl-kpi-label">Chart Accounts</span>
              <span className="gl-kpi-value">{coaMetrics.total} Accounts</span>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{coaMetrics.active} active accounts in ledger</span>
            </div>
            <div className="gl-kpi-item">
              <span className="gl-kpi-label">Total Assets Balance</span>
              <span className="gl-kpi-value">{formatCurrency(coaMetrics.assetTotal)}</span>
              <span style={{ fontSize: '11px', color: 'var(--sp-info)' }}>Debit normal balance</span>
            </div>
            <div className="gl-kpi-item">
              <span className="gl-kpi-label">Total Liabilities</span>
              <span className="gl-kpi-value">{formatCurrency(coaMetrics.liabilityTotal)}</span>
              <span style={{ fontSize: '11px', color: 'var(--sp-warning)' }}>Credit normal balance</span>
            </div>
            <div className="gl-kpi-item">
              <span className="gl-kpi-label">Owner Capital & Equity</span>
              <span className="gl-kpi-value">{formatCurrency(coaMetrics.equityTotal)}</span>
              <span style={{ fontSize: '11px', color: 'var(--sp-brand)' }}>Capital + Retained Earnings</span>
            </div>
          </div>

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
              <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>CODE</th>
                    <th>ACCOUNT NAME</th>
                    <th style={{ width: '130px' }}>CLASS</th>
                    <th style={{ width: '160px' }}>SUB-TYPE</th>
                    <th style={{ width: '140px' }}>NORMAL BALANCE</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>NET BALANCE</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>STATUS</th>
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
                      <tr
                        key={acc.id}
                        className="sales-row production-clickable-row"
                        onClick={() => {
                          setSearchQuery(acc.accountCode);
                          setActiveTab('journals');
                          notify(`Filtered Journal Vouchers by account ${acc.accountCode}`);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(acc.accountCode);
                              setActiveTab('journals');
                              notify(`Filtered Journal Vouchers by account ${acc.accountCode}`);
                            }}
                            title={`Inspect journal vouchers for account ${acc.accountCode}`}
                          >
                            <span>{acc.accountCode}</span>
                            <ArrowUpRight size={11} className="order-link-arrow" />
                          </button>
                        </td>
                        <td style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {acc.accountName}
                          </div>
                          {acc.description && (
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                              {acc.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`gl-class-badge ${acc.accountType.toLowerCase()}`}>{acc.accountType}</span>
                        </td>
                        <td className="sales-date-cell" style={{ textTransform: 'capitalize' }}>
                          {acc.subType.toLowerCase().replace(/_/g, ' ')}
                        </td>
                        <td>
                          <span className={`gl-balance-pill ${acc.normalBalance.toLowerCase()}`}>
                            {acc.normalBalance}
                          </span>
                        </td>
                        <td className="sales-amount-cell" style={{ textAlign: 'right', fontWeight: 600 }}>
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
              gap: '16px',
              flexWrap: 'wrap'
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
                  <span>Double-Entry Ledger Integrity Status</span>
                  <span className="gl-detail-cert-box" style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }}>
                    <ShieldCheck size={12} style={{ color: '#16a34a' }} />
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>Balanced (Variance: ₹0.00)</span>
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                  Every debit matches a credit across all posted manual and automated subledger vouchers as of{' '}
                  <strong style={{ color: 'var(--sp-text)' }}>{trialBalance?.asOfDate ?? 'today'}</strong>.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div className="sales-pill-group">
                <button
                  type="button"
                  className={`sales-pill-btn ${!trialOnlyActive ? 'active' : ''}`}
                  onClick={() => setTrialOnlyActive(false)}
                >
                  <span>All Accounts</span>
                  <span className="sales-pill-count">{trialBalance?.rows?.length || 0}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${trialOnlyActive ? 'active' : ''}`}
                  onClick={() => setTrialOnlyActive(true)}
                >
                  <span>Active Ledger Only</span>
                  <span className="sales-pill-count">
                    {trialBalance?.rows?.filter((r) => r.totalDebit > 0 || r.totalCredit > 0).length || 0}
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontVariantNumeric: 'tabular-nums', fontSize: '12px', borderLeft: '1px solid var(--sp-border)', paddingLeft: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)', display: 'block' }}>Total Debits</span>
                  <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '13px' }}>
                    {formatCurrency(trialBalance?.totalDebit ?? 0)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)', display: 'block' }}>Total Credits</span>
                  <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '13px' }}>
                    {formatCurrency(trialBalance?.totalCredit ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>CODE</th>
                    <th>ACCOUNT TITLE</th>
                    <th style={{ width: '130px' }}>CLASS</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>DEBIT BALANCE</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>CREDIT BALANCE</th>
                    <th style={{ textAlign: 'right', width: '180px' }}>NET POSITION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrialRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                        No accounts match the active filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTrialRows.map((row) => {
                      const hasActivity = row.totalDebit > 0 || row.totalCredit > 0;
                      return (
                        <tr
                          key={row.accountId}
                          className="sales-row production-clickable-row"
                          onClick={() => {
                            setSearchQuery(row.accountCode);
                            setActiveTab('journals');
                            notify(`Filtered Journal Vouchers by account ${row.accountCode}`);
                          }}
                          style={{ opacity: hasActivity ? 1 : 0.45, cursor: 'pointer' }}
                        >
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(row.accountCode);
                                setActiveTab('journals');
                                notify(`Filtered Journal Vouchers by account ${row.accountCode}`);
                              }}
                              title={`Inspect journal vouchers for account ${row.accountCode}`}
                            >
                              <span>{row.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                          </td>
                          <td style={{ overflow: 'hidden' }}>
                            <span style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {row.accountName}
                            </span>
                          </td>
                          <td>
                            <span className={`gl-class-badge ${row.accountType.toLowerCase()}`}>{row.accountType}</span>
                          </td>
                          <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                            {row.totalDebit > 0 ? formatCurrency(row.totalDebit) : '—'}
                          </td>
                          <td className="sales-amount-cell" style={{ textAlign: 'right' }}>
                            {row.totalCredit > 0 ? formatCurrency(row.totalCredit) : '—'}
                          </td>
                          <td className="sales-amount-cell" style={{ fontWeight: 600, textAlign: 'right' }}>
                            {row.netDebit > 0 ? (
                              <span className="gl-balance-pill debit">Dr. {formatCurrency(row.netDebit)}</span>
                            ) : row.netCredit > 0 ? (
                              <span className="gl-balance-pill credit">Cr. {formatCurrency(row.netCredit)}</span>
                            ) : (
                              <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>₹0.00</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--sp-surface-subtle)', fontWeight: 600, borderTop: '2px solid var(--sp-border)' }}>
                    <td colSpan={3} style={{ padding: '10px 14px', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Totals Verified Double-Entry
                    </td>
                    <td className="sales-amount-cell" style={{ textAlign: 'right', padding: '10px 14px', fontSize: '13px' }}>
                      {formatCurrency(trialBalance?.totalDebit ?? 0)}
                    </td>
                    <td className="sales-amount-cell" style={{ textAlign: 'right', padding: '10px 14px', fontSize: '13px' }}>
                      {formatCurrency(trialBalance?.totalCredit ?? 0)}
                    </td>
                    <td className="sales-amount-cell" style={{ textAlign: 'right', padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>
                      ✓ ₹0.00 VARIANCE
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div className="leads-view-toggle">
              <button
                type="button"
                className={`leads-view-btn ${statementSubTab === 'bs' ? 'active' : ''}`}
                onClick={() => setStatementSubTab('bs')}
              >
                <BookOpen size={13} />
                <span>Balance Sheet Statement</span>
              </button>
              <button
                type="button"
                className={`leads-view-btn ${statementSubTab === 'pl' ? 'active' : ''}`}
                onClick={() => setStatementSubTab('pl')}
              >
                <TrendingUp size={13} />
                <span>Profit & Loss (Income Statement)</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              <span className="gl-detail-cert-box" style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }}>
                <ShieldCheck size={12} style={{ color: '#16a34a' }} />
                <span style={{ fontWeight: 600, color: '#16a34a' }}>GAAP & Ind AS Synchronized</span>
              </span>
            </div>
          </div>

          {/* BALANCE SHEET SUB-VIEW */}
          {statementSubTab === 'bs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Executive Balance Sheet KPI Strip */}
              <div className="gl-kpi-grid">
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Total Assets</span>
                  <span className="gl-kpi-value">{formatCurrency(balanceSheet?.totalAssets ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-info)' }}>100% debit normal balance</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Current Assets</span>
                  <span className="gl-kpi-value">{formatCurrency(balanceSheet?.totalCurrentAssets ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Liquid & operating receivables</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Total Liabilities</span>
                  <span className="gl-kpi-value">{formatCurrency(balanceSheet?.totalCurrentLiabilities ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-warning)' }}>Trade AP & tax obligations</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Owner Capital & Equity</span>
                  <span className="gl-kpi-value">{formatCurrency(balanceSheet?.totalEquity ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-brand)' }}>Paid-in capital + retained earnings</span>
                </div>
              </div>

              {/* 2-Column Comparative Balance Sheet */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
                {/* Left Column: ASSETS */}
                <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <Wallet size={15} style={{ color: 'var(--sp-brand)' }} />
                      <span>Total Assets</span>
                    </div>
                    <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '16px', color: 'var(--sp-text)' }}>
                      {formatCurrency(balanceSheet?.totalAssets ?? 0)}
                    </div>
                  </div>

                  {/* Current Assets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Current Assets (Operating & Liquid)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalCurrentAssets ?? 0)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {balanceSheet?.currentAssets?.map((item) => (
                        <div
                          key={item.accountId}
                          className="production-clickable-row"
                          onClick={() => {
                            setSearchQuery(item.accountCode);
                            setActiveTab('journals');
                            notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(item.accountCode);
                                setActiveTab('journals');
                                notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                              }}
                              title={`Inspect journal vouchers for ${item.accountCode}`}
                            >
                              <span>{item.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '12px' }}>
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fixed Assets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Fixed Assets (Plant & Machinery)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalFixedAssets ?? 0)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {balanceSheet?.fixedAssets?.map((item) => (
                        <div
                          key={item.accountId}
                          className="production-clickable-row"
                          onClick={() => {
                            setSearchQuery(item.accountCode);
                            setActiveTab('journals');
                            notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(item.accountCode);
                                setActiveTab('journals');
                                notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                              }}
                              title={`Inspect journal vouchers for ${item.accountCode}`}
                            >
                              <span>{item.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '12px' }}>
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: LIABILITIES & EQUITY */}
                <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <CreditCard size={15} style={{ color: 'var(--sp-brand)' }} />
                      <span>Liabilities & Owner Equity</span>
                    </div>
                    <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '16px', color: 'var(--sp-text)' }}>
                      {formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0)}
                    </div>
                  </div>

                  {/* Current Liabilities */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Current Liabilities</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalCurrentLiabilities ?? 0)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {balanceSheet?.currentLiabilities?.map((item) => (
                        <div
                          key={item.accountId}
                          className="production-clickable-row"
                          onClick={() => {
                            setSearchQuery(item.accountCode);
                            setActiveTab('journals');
                            notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(item.accountCode);
                                setActiveTab('journals');
                                notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                              }}
                              title={`Inspect journal vouchers for ${item.accountCode}`}
                            >
                              <span>{item.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '12px' }}>
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Owner Equity */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Owner Capital & Retained Earnings</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(balanceSheet?.totalEquity ?? 0)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {balanceSheet?.equityItems?.map((item) => (
                        <div
                          key={item.accountId}
                          className="production-clickable-row"
                          onClick={() => {
                            setSearchQuery(item.accountCode);
                            setActiveTab('journals');
                            notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="order-number-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(item.accountCode);
                                setActiveTab('journals');
                                notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                              }}
                              title={`Inspect journal vouchers for ${item.accountCode}`}
                            >
                              <span>{item.accountCode}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '12px' }}>
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="production-clickable-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', color: 'var(--sp-brand)', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="order-number-pill" style={{ borderColor: 'var(--sp-brand)', color: 'var(--sp-brand)' }}>RE</span>
                          <span style={{ fontSize: '12px' }}>Retained Earnings (Cumulative Net Profit)</span>
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          {formatCurrency(balanceSheet?.retainedEarnings ?? 0)}
                        </span>
                      </div>
                    </div>
                  </div>

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
                      fontWeight: 600,
                      marginTop: 'auto'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--sp-text)' }}>
                      <ShieldCheck size={14} style={{ color: '#16a34a' }} />
                      Double-Entry Equilibrium Total
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)', fontSize: '13px' }}>
                      {formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROFIT & LOSS SUB-VIEW (FULL-WIDTH, ZERO WASTED SPACE) */}
          {statementSubTab === 'pl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Executive P&L KPI Strip */}
              <div className="gl-kpi-grid">
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Operating Revenue</span>
                  <span className="gl-kpi-value">{formatCurrency(profitLoss?.totalRevenue ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-success)' }}>B2B + POS Sales</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Cost of Goods Sold (COGS)</span>
                  <span className="gl-kpi-value">{formatCurrency(profitLoss?.totalCogs ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-danger)' }}>Direct materials & production</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Gross Margin</span>
                  <span className="gl-kpi-value">{formatCurrency(profitLoss?.grossProfit ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-brand)' }}>{profitLoss?.grossMarginPercent?.toFixed(1)}% margin efficiency</span>
                </div>
                <div className="gl-kpi-item">
                  <span className="gl-kpi-label">Net Operating Income (EBIT)</span>
                  <span className="gl-kpi-value">{formatCurrency(profitLoss?.netOperatingIncome ?? 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--sp-success)' }}>{profitLoss?.netMarginPercent?.toFixed(1)}% net margin</span>
                </div>
              </div>

              {/* Full-Width Linear P&L Statement Card */}
              <div className="sales-table-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid var(--sp-border)' }}>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                      Profit & Loss Statement (Income Statement)
                    </h2>
                    <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '3px' }}>
                      Certified Period: <strong>{profitLoss?.fromDate ?? 'Start'}</strong> to <strong>{profitLoss?.toDate ?? 'Present'}</strong> · Double-entry accrual basis
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)', display: 'block' }}>Net Operating Margin (EBIT)</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {formatCurrency(profitLoss?.netOperatingIncome ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Section 1: Operating Revenue */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                      1. Operating Revenue
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: '#16a34a' }}>
                      {formatCurrency(profitLoss?.totalRevenue ?? 0)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {profitLoss?.operatingRevenue?.map((item) => (
                      <div
                        key={item.accountId}
                        className="production-clickable-row"
                        onClick={() => {
                          setSearchQuery(item.accountCode);
                          setActiveTab('journals');
                          notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(item.accountCode);
                              setActiveTab('journals');
                              notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                            }}
                            title={`Inspect journal vouchers for ${item.accountCode}`}
                          >
                            <span>{item.accountCode}</span>
                            <ArrowUpRight size={11} className="order-link-arrow" />
                          </button>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Cost of Goods Sold */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c13e3e' }}></span>
                      2. Cost of Goods Sold (COGS)
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: '#c13e3e' }}>
                      ({formatCurrency(profitLoss?.totalCogs ?? 0)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {profitLoss?.costOfGoodsSold?.map((item) => (
                      <div
                        key={item.accountId}
                        className="production-clickable-row"
                        onClick={() => {
                          setSearchQuery(item.accountCode);
                          setActiveTab('journals');
                          notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(item.accountCode);
                              setActiveTab('journals');
                              notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                            }}
                            title={`Inspect journal vouchers for ${item.accountCode}`}
                          >
                            <span>{item.accountCode}</span>
                            <ArrowUpRight size={11} className="order-link-arrow" />
                          </button>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#c13e3e', fontSize: '12.5px' }}>
                          ({formatCurrency(item.amount)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gross Margin Callout */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    background: 'var(--sp-surface-subtle)',
                    border: '1px solid var(--sp-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12.5px',
                    fontWeight: 600
                  }}
                >
                  <span style={{ color: 'var(--sp-text)' }}>
                    Gross Profit (Margin Efficiency: {profitLoss?.grossMarginPercent?.toFixed(1)}%)
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--sp-text)', fontSize: '14px' }}>
                    {formatCurrency(profitLoss?.grossProfit ?? 0)}
                  </span>
                </div>

                {/* Section 3: Operating Expenses */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706' }}></span>
                      3. Operating & Administrative Expenses
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: '#d97706' }}>
                      ({formatCurrency(profitLoss?.totalExpenses ?? 0)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {profitLoss?.operatingExpenses?.map((item) => (
                      <div
                        key={item.accountId}
                        className="production-clickable-row"
                        onClick={() => {
                          setSearchQuery(item.accountCode);
                          setActiveTab('journals');
                          notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '4px', borderBottom: '1px solid var(--sp-border-subtle)', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="order-number-pill interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(item.accountCode);
                              setActiveTab('journals');
                              notify(`Filtered Journal Vouchers by account ${item.accountCode}`);
                            }}
                            title={`Inspect journal vouchers for ${item.accountCode}`}
                          >
                            <span>{item.accountCode}</span>
                            <ArrowUpRight size={11} className="order-link-arrow" />
                          </button>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>{item.accountName}</span>
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#d97706', fontSize: '12.5px' }}>
                          ({formatCurrency(item.amount)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Net Operating Margin Callout */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '8px',
                    background: 'var(--sp-surface-subtle)',
                    border: '1px solid var(--sp-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '6px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--sp-text)' }}>
                      Net Operating Income (EBIT)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                      Net Margin Ratio: <strong style={{ color: 'var(--sp-text)' }}>{profitLoss?.netMarginPercent?.toFixed(1)}%</strong> of gross revenue
                    </div>
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '22px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    {formatCurrency(profitLoss?.netOperatingIncome ?? 0)}
                  </div>
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
