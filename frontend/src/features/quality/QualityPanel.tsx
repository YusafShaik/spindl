import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Award,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Info,
  Lock,
  MinusCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Warehouse,
  X,
  XCircle
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import type { QualityItem, QualityLot } from '../../types/quality';

type QualityTab = 'queue' | 'rules' | 'history' | 'standards';
type QueueFilter = 'ALL' | 'PURCHASE_RECEIPT' | 'WORK_ORDER_OUTPUT' | 'OPENING_STOCK' | 'CUSTOMER_RETURN';
type RulesFilter = 'ALL' | 'REQUIRED' | 'STANDARD';
type HistoryFilter = 'ALL' | 'RELEASED' | 'MIXED' | 'REJECTED';

interface QualityPanelProps {
  role?: string;
  notify: (message: string) => void;
  onRefresh: () => Promise<void>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return String(iso);
  }
}

function truncateRef(ref: string): string {
  if (!ref) return '—';
  if (ref.length <= 22) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-8)}`;
}

function formatSourceType(type: string): string {
  switch (type) {
    case 'PURCHASE_RECEIPT': return 'Purchase Receipt';
    case 'WORK_ORDER_OUTPUT': return 'Work Order Output';
    case 'OPENING_STOCK': return 'Opening Stock';
    case 'CUSTOMER_RETURN': return 'Customer Return';
    default: return type.replace(/_/g, ' ');
  }
}

function getSourceIcon(type: string) {
  switch (type) {
    case 'PURCHASE_RECEIPT': return <Truck size={12} />;
    case 'WORK_ORDER_OUTPUT': return <Boxes size={12} />;
    case 'OPENING_STOCK': return <Warehouse size={12} />;
    case 'CUSTOMER_RETURN': return <RotateCcw size={12} />;
    default: return <FileText size={12} />;
  }
}

export function QualityPanel({ role, notify, onRefresh }: QualityPanelProps) {
  const [items, setItems] = useState<QualityItem[]>([]);
  const [lots, setLots] = useState<QualityLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<QualityTab>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [rulesFilter, setRulesFilter] = useState<RulesFilter>('ALL');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');

  // Inspection modal state
  const [inspectingLot, setInspectingLot] = useState<QualityLot | null>(null);
  const [modalOutcome, setModalOutcome] = useState<'PASS' | 'FAIL'>('PASS');
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalNotes, setModalNotes] = useState<string>('');

  const canConfigure = role !== undefined && ['OWNER', 'ADMIN', 'MANAGER'].includes(role);

  const load = async () => {
    const [itemResponse, lotResponse] = await Promise.all([
      apiFetch(`${API}/quality/items`),
      apiFetch(`${API}/quality/lots`)
    ]);
    if (!itemResponse.ok || !lotResponse.ok) throw new Error('Could not load quality records');
    const [itemData, lotData] = await Promise.all([itemResponse.json(), lotResponse.json()]);
    setItems(itemData);
    setLots(lotData);
  };

  useEffect(() => {
    load()
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, []);

  // Synchronize modal quantity when a lot is chosen for inspection
  const openInspectModal = (lot: QualityLot) => {
    setInspectingLot(lot);
    setModalOutcome('PASS');
    setModalQuantity(lot.remainingQuantity);
    setModalNotes('');
  };

  const closeInspectModal = () => {
    if (saving) return;
    setInspectingLot(null);
    setModalNotes('');
  };

  const setRequired = async (item: QualityItem): Promise<void> => {
    if (item.inspectionRequired && item.heldQuantity > 0) {
      notify(`Cannot disable inspection: ${item.sku} has ${item.heldQuantity} units in quality hold. Inspect or release held stock first.`);
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/quality/items/${item.id}/inspection-required`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !item.inspectionRequired })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not change inspection requirement');
      await load();
      await onRefresh();
      notify(`${item.sku} inspection ${body.inspectionRequired ? 'enabled' : 'disabled'}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleModalInspectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inspectingLot) return;
    if (modalQuantity <= 0 || modalQuantity > inspectingLot.remainingQuantity) {
      notify(`Inspection quantity must be between 1 and ${inspectingLot.remainingQuantity}`);
      return;
    }

    const payload = {
      outcome: modalOutcome,
      quantity: modalQuantity,
      notes: modalNotes.trim() ? modalNotes.trim() : null,
      idempotencyKey: crypto.randomUUID()
    };

    setSaving(true);
    try {
      const response = await apiFetch(`${API}/quality/lots/${inspectingLot.id}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not record inspection');
      await load();
      await onRefresh();
      const outcomeText = modalOutcome === 'PASS' ? 'released to available stock' : 'scrapped & debited from inventory';
      notify(`${inspectingLot.sku}: ${payload.quantity} units ${outcomeText}`);
      closeInspectModal();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  // Quick 100% Pass Disposition from Queue row
  const quickPassAll = async (lot: QualityLot) => {
    const payload = {
      outcome: 'PASS',
      quantity: lot.remainingQuantity,
      notes: 'Quick standard acceptance release',
      idempotencyKey: crypto.randomUUID()
    };
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/quality/lots/${lot.id}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not record inspection');
      await load();
      await onRefresh();
      notify(`${lot.sku}: ${payload.quantity} units released to available stock`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const exportQCReport = () => {
    const headers = ['Lot ID', 'SKU', 'Item Name', 'Source Type', 'Source Reference', 'Total Qty', 'Remaining Qty', 'Passed Qty', 'Rejected Qty', 'Status', 'Created At'];
    const rows = lots.map(l => [
      l.id,
      `"${l.sku}"`,
      `"${l.itemName.replace(/"/g, '""')}"`,
      l.sourceType,
      `"${l.sourceReference}"`,
      l.quantity,
      l.remainingQuantity,
      l.passedQuantity,
      l.rejectedQuantity,
      l.status,
      l.createdAt
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `spindl-quality-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Quality control audit report exported as CSV');
  };

  // KPI calculations
  const pendingLots = useMemo(() => lots.filter(lot => lot.remainingQuantity > 0), [lots]);
  const completedLots = useMemo(() => lots.filter(lot => lot.remainingQuantity === 0), [lots]);

  const totalUnitsAwaiting = useMemo(() => {
    return pendingLots.reduce((sum, l) => sum + l.remainingQuantity, 0);
  }, [pendingLots]);

  const totalHeldStock = useMemo(() => {
    return items.reduce((sum, i) => sum + (i.heldQuantity || 0), 0);
  }, [items]);

  const totalPassedUnits = useMemo(() => {
    return lots.reduce((sum, l) => sum + (l.passedQuantity || 0), 0);
  }, [lots]);

  const totalRejectedUnits = useMemo(() => {
    return lots.reduce((sum, l) => sum + (l.rejectedQuantity || 0), 0);
  }, [lots]);

  const firstPassYield = useMemo(() => {
    const total = totalPassedUnits + totalRejectedUnits;
    if (total === 0) return '100.0';
    return ((totalPassedUnits / total) * 100).toFixed(1);
  }, [totalPassedUnits, totalRejectedUnits]);

  const activeRulesCount = useMemo(() => {
    return items.filter(i => i.inspectionRequired).length;
  }, [items]);

  // Filtered queue lots
  const filteredQueueLots = useMemo(() => {
    let list = pendingLots;
    if (queueFilter !== 'ALL') {
      list = list.filter(l => l.sourceType === queueFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(l =>
        l.sku.toLowerCase().includes(q) ||
        l.itemName.toLowerCase().includes(q) ||
        l.sourceReference.toLowerCase().includes(q) ||
        l.warehouseName.toLowerCase().includes(q) ||
        l.warehouseCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pendingLots, queueFilter, searchQuery]);

  // Filtered rules items
  const filteredRulesItems = useMemo(() => {
    let list = items;
    if (rulesFilter === 'REQUIRED') {
      list = list.filter(i => i.inspectionRequired);
    } else if (rulesFilter === 'STANDARD') {
      list = list.filter(i => !i.inspectionRequired);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.sku.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, rulesFilter, searchQuery]);

  // Filtered completed lots
  const filteredCompletedLots = useMemo(() => {
    let list = completedLots;
    if (historyFilter !== 'ALL') {
      list = list.filter(l => l.status === historyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(l =>
        l.sku.toLowerCase().includes(q) ||
        l.itemName.toLowerCase().includes(q) ||
        l.sourceReference.toLowerCase().includes(q)
      );
    }
    return list;
  }, [completedLots, historyFilter, searchQuery]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Linear Executive KPI Metric Cards */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">INSPECTION QUEUE</span>
            <ClipboardCheck size={14} className="sales-metric-icon quotes" />
          </div>
          <div className="sales-metric-val">{pendingLots.length} <small style={{ fontSize: '13px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>lots</small></div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{totalUnitsAwaiting.toLocaleString()} units</span> awaiting disposition
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">QUARANTINE & HOLD</span>
            <ShieldAlert size={14} className="sales-metric-icon credits" />
          </div>
          <div className="sales-metric-val">{totalHeldStock.toLocaleString()} <small style={{ fontSize: '13px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>PCS</small></div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Quarantine hold</span> · Zero unauthorized release
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACCEPTANCE YIELD (FPY)</span>
            <Award size={14} className="sales-metric-icon orders" />
          </div>
          <div className="sales-metric-val">{firstPassYield}%</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{totalPassedUnits} passed</span> · {totalRejectedUnits} scrapped
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">QC GATE COVERAGE</span>
            <SlidersHorizontal size={14} className="sales-metric-icon trend" />
          </div>
          <div className="sales-metric-val">{activeRulesCount} <small style={{ fontSize: '13px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>/ {items.length} items</small></div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Automated holds</span> on receipt & WIP outputs
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <ClipboardCheck size={14} />
            <span>Inspection Queue</span>
            <span className="sales-subnav-badge">{pendingLots.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <ShieldCheck size={14} />
            <span>Inspection Rules</span>
            <span className="sales-subnav-badge">{items.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Completed History</span>
            <span className="sales-subnav-badge">{completedLots.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'standards' ? 'active' : ''}`}
            onClick={() => setActiveTab('standards')}
          >
            <Award size={14} />
            <span>Standards & Gates</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn"
            onClick={exportQCReport}
            title="Export full QC lots ledger"
          >
            <Download size={13} />
            <span>Export QC Report</span>
          </button>
        </div>
      </div>

      {/* 3. Dynamic Search & Filters Toolbar */}
      {activeTab !== 'standards' && (
        <div className="sales-toolbar">
          <div className="sales-search-box">
            <Search size={14} />
            <input
              className="sales-search-input"
              placeholder={
                activeTab === 'queue'
                  ? 'Search queue by SKU, lot, source ref (PO/WO)...'
                  : activeTab === 'rules'
                  ? 'Search items by SKU, name, unit...'
                  : 'Search history by lot, source ref, SKU...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="sales-kbd">/</kbd>
          </div>

          <div className="sales-filter-pills">
            {activeTab === 'queue' && (
              <>
                <button
                  type="button"
                  className={`sales-filter-pill ${queueFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('ALL')}
                >
                  All <span>{pendingLots.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${queueFilter === 'PURCHASE_RECEIPT' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('PURCHASE_RECEIPT')}
                >
                  Purchase Receipts <span>{pendingLots.filter(l => l.sourceType === 'PURCHASE_RECEIPT').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${queueFilter === 'WORK_ORDER_OUTPUT' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('WORK_ORDER_OUTPUT')}
                >
                  Work Orders <span>{pendingLots.filter(l => l.sourceType === 'WORK_ORDER_OUTPUT').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${queueFilter === 'OPENING_STOCK' ? 'active' : ''}`}
                  onClick={() => setQueueFilter('OPENING_STOCK')}
                >
                  Opening Stock <span>{pendingLots.filter(l => l.sourceType === 'OPENING_STOCK').length}</span>
                </button>
              </>
            )}

            {activeTab === 'rules' && (
              <>
                <button
                  type="button"
                  className={`sales-filter-pill ${rulesFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRulesFilter('ALL')}
                >
                  All Items <span>{items.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${rulesFilter === 'REQUIRED' ? 'active' : ''}`}
                  onClick={() => setRulesFilter('REQUIRED')}
                >
                  Mandatory QC <span>{items.filter(i => i.inspectionRequired).length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${rulesFilter === 'STANDARD' ? 'active' : ''}`}
                  onClick={() => setRulesFilter('STANDARD')}
                >
                  Direct Release <span>{items.filter(i => !i.inspectionRequired).length}</span>
                </button>
              </>
            )}

            {activeTab === 'history' && (
              <>
                <button
                  type="button"
                  className={`sales-filter-pill ${historyFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('ALL')}
                >
                  All History <span>{completedLots.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${historyFilter === 'RELEASED' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('RELEASED')}
                >
                  Released <span>{completedLots.filter(l => l.status === 'RELEASED').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${historyFilter === 'MIXED' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('MIXED')}
                >
                  Mixed <span>{completedLots.filter(l => l.status === 'MIXED').length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-filter-pill ${historyFilter === 'REJECTED' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('REJECTED')}
                >
                  Rejected <span>{completedLots.filter(l => l.status === 'REJECTED').length}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. Active Sub-Tab Registers */}

      {/* SUB-TAB 1: Inspection Queue */}
      {activeTab === 'queue' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>SOURCE REF</th>
                  <th>ITEM SPECIFICATION</th>
                  <th style={{ width: '135px' }}>ORIGIN TYPE</th>
                  <th style={{ width: '85px' }}>LOT QTY</th>
                  <th style={{ width: '175px' }}>DISPOSITION STATUS</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <div className="sales-empty-title">Loading inspection queue…</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredQueueLots.length > 0 ? (
                  filteredQueueLots.map((lot) => {
                    const passPercent = Math.round((lot.passedQuantity / lot.quantity) * 100);
                    const rejectPercent = Math.round((lot.rejectedQuantity / lot.quantity) * 100);
                    const remainingPercent = 100 - passPercent - rejectPercent;

                    return (
                      <tr key={lot.id} className="sales-row">
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="sales-ref-badge" title={lot.sourceReference} style={{ alignSelf: 'flex-start' }}>
                              {truncateRef(lot.sourceReference)}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                              {formatDateTime(lot.createdAt)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                                {lot.sku}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>·</span>
                              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                                {lot.warehouseCode} ({lot.warehouseName})
                              </span>
                            </div>
                            <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                              {lot.itemName}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className={`quality-lot-source-tag ${lot.sourceType}`}>
                            {getSourceIcon(lot.sourceType)}
                            <span>{formatSourceType(lot.sourceType)}</span>
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {lot.quantity.toLocaleString()}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>total units</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div className="quality-progress-bar">
                              {passPercent > 0 && <div className="quality-progress-seg passed" style={{ width: `${passPercent}%` }} />}
                              {rejectPercent > 0 && <div className="quality-progress-seg rejected" style={{ width: `${rejectPercent}%` }} />}
                              {remainingPercent > 0 && <div className="quality-progress-seg remaining" style={{ width: `${remainingPercent}%` }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                              <span style={{ fontWeight: 600, color: '#d97706' }}>
                                {lot.remainingQuantity.toLocaleString()} awaiting
                              </span>
                              {lot.passedQuantity > 0 && (
                                <span style={{ color: '#059669' }}>· {lot.passedQuantity} passed</span>
                              )}
                              {lot.rejectedQuantity > 0 && (
                                <span style={{ color: '#dc2626' }}>· {lot.rejectedQuantity} rejected</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="sales-actions-cell">
                            <button
                              type="button"
                              className="sales-action-btn primary"
                              onClick={() => openInspectModal(lot)}
                              disabled={saving}
                            >
                              <ClipboardCheck size={12} />
                              <span>Inspect</span>
                            </button>

                            <button
                              type="button"
                              className="sales-action-btn"
                              onClick={() => void quickPassAll(lot)}
                              disabled={saving}
                              title="Quickly pass 100% of remaining units to available stock"
                            >
                              <Check size={12} />
                              <span>Pass all</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 8px', opacity: 0.8 }} />
                        <div className="sales-empty-title">Inspection queue empty</div>
                        <div className="sales-empty-desc">
                          {searchQuery
                            ? `No pending inspection lots matching "${searchQuery}".`
                            : 'All incoming receipts and work order outputs have been inspected and released to active inventory.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Inspection Rules */}
      {activeTab === 'rules' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>ITEM SKU</th>
                  <th>ITEM NAME</th>
                  <th style={{ width: '120px' }}>ON HAND</th>
                  <th style={{ width: '140px' }}>QUALITY HOLD</th>
                  <th style={{ width: '140px' }}>AVAILABLE</th>
                  <th style={{ width: '180px' }}>GATE POLICY</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <div className="sales-empty-title">Loading inspection rules…</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredRulesItems.length > 0 ? (
                  filteredRulesItems.map((item) => {
                    const hasHold = (item.heldQuantity || 0) > 0;

                    return (
                      <tr key={item.id} className="sales-row">
                        <td>
                          <span className="sales-ref-badge">{item.sku}</span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              Unit: {item.unit}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {item.onHand.toLocaleString()} {item.unit}
                          </span>
                        </td>

                        <td>
                          {hasHold ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#d97706', fontVariantNumeric: 'tabular-nums', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                              <ShieldAlert size={11} />
                              {item.heldQuantity.toLocaleString()} {item.unit}
                            </span>
                          ) : (
                            <span className="sales-sub-ref">—</span>
                          )}
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px' }}>
                            {item.availableQuantity.toLocaleString()} {item.unit}
                          </span>
                        </td>

                        <td>
                          {item.inspectionRequired ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, color: '#059669', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                              <ShieldCheck size={12} />
                              Mandatory QC
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', background: 'var(--sp-surface-subtle)', border: '1px solid var(--sp-border)' }}>
                              <CheckCircle2 size={12} />
                              Direct Release
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="sales-actions-cell">
                            {canConfigure ? (
                              <button
                                type="button"
                                className={`sales-action-btn ${item.inspectionRequired ? '' : 'primary'}`}
                                disabled={saving}
                                onClick={() => void setRequired(item)}
                                title={
                                  item.inspectionRequired && hasHold
                                    ? `Cannot disable: ${item.heldQuantity} units in hold must be inspected first`
                                    : item.inspectionRequired
                                    ? 'Disable inspection gate'
                                    : 'Enable mandatory inspection gate'
                                }
                              >
                                {item.inspectionRequired ? (
                                  <>
                                    <MinusCircle size={12} />
                                    <span>Disable gate</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={12} />
                                    <span>Enable gate</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Admin only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <div className="sales-empty-title">No items found</div>
                        <div className="sales-empty-desc">No active items match the current query or filter.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Completed History */}
      {activeTab === 'history' && (
        <div className="sales-table-card">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>LOT REF</th>
                  <th>ITEM SPECIFICATION</th>
                  <th style={{ width: '150px' }}>SOURCE ORIGIN</th>
                  <th style={{ width: '100px' }}>TOTAL</th>
                  <th style={{ width: '110px' }}>PASSED</th>
                  <th style={{ width: '110px' }}>SCRAPPED</th>
                  <th style={{ width: '120px' }}>FINAL STATUS</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>RECORDED</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <div className="sales-empty-title">Loading history…</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredCompletedLots.length > 0 ? (
                  filteredCompletedLots.map((lot) => (
                    <tr key={lot.id} className="sales-row">
                      <td>
                        <span className="sales-ref-badge" title={lot.sourceReference}>
                          {truncateRef(lot.sourceReference)}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                            {lot.sku}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                            {lot.itemName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`quality-lot-source-tag ${lot.sourceType}`}>
                          {getSourceIcon(lot.sourceType)}
                          <span>{formatSourceType(lot.sourceType)}</span>
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                          {lot.quantity.toLocaleString()}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                          +{lot.passedQuantity.toLocaleString()}
                        </span>
                      </td>

                      <td>
                        {lot.rejectedQuantity > 0 ? (
                          <span style={{ fontWeight: 600, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                            -{lot.rejectedQuantity.toLocaleString()}
                          </span>
                        ) : (
                          <span className="sales-sub-ref">—</span>
                        )}
                      </td>

                      <td>
                        <span className={`quality-status-pill ${lot.status}`}>
                          {lot.status === 'RELEASED' && <CheckCircle2 size={11} />}
                          {lot.status === 'REJECTED' && <XCircle size={11} />}
                          {lot.status === 'MIXED' && <AlertTriangle size={11} />}
                          <span>{lot.status}</span>
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatDate(lot.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="sales-empty-cell">
                      <div className="sales-empty-state">
                        <div className="sales-empty-title">No completed inspections</div>
                        <div className="sales-empty-desc">Completed lot inspections and dispositions will be archived here.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Quality Standards & ISO Gates */}
      {activeTab === 'standards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div className="sales-table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ShieldCheck size={18} style={{ color: '#6366f1' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Incoming Receipt Quarantine (Inbound Gate)
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Items with mandatory quality inspection hold all incoming goods receipts in a quarantine balance. Units cannot be reserved, dispatched, or consumed in manufacturing work orders until a formal quality disposition is approved.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="sales-item-tag">Strict Inventory Lock</span>
              <span className="sales-item-tag">Zero Sales Allocation</span>
              <span className="sales-item-tag">ISO 9001 §8.6 Compliant</span>
            </div>
          </div>

          <div className="sales-table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Dual-Ledger Disposition Protocol
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', lineHeight: 1.5, margin: 0 }}>
              <b>Pass decisions</b> immediately release stock into available inventory for immediate shipment or BOM assembly. <b>Fail decisions</b> irrevocably decrement on-hand quantity and post a permanent negative inventory ledger movement with immutable traceability.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="sales-item-tag">Immutable Ledger Audit</span>
              <span className="sales-item-tag">Automated Scrap Posting</span>
              <span className="sales-item-tag">Idempotent Disposition</span>
            </div>
          </div>

          <div className="sales-table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Boxes size={18} style={{ color: '#06b6d4' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Work Order & Production Gates (In-Process)
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Finished goods produced by assembly work orders undergo final end-of-line verification. Sub-assemblies failing dimensional CMM tolerances can be rejected without affecting healthy parent lots.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="sales-item-tag">Partial Lot Sampling</span>
              <span className="sales-item-tag">CMM Report Archival</span>
              <span className="sales-item-tag">AS9100 Standard</span>
            </div>
          </div>

          <div className="sales-table-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Lock size={18} style={{ color: '#f59e0b' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Non-Destructive Integrity Guards
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Mandatory inspection cannot be deactivated while uninspected stock sits in quality hold. Likewise, inspection cannot be activated on items with active customer or manufacturing reservations until allocations are cleared.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="sales-item-tag">Conflict Prevention</span>
              <span className="sales-item-tag">Reservation Safety</span>
              <span className="sales-item-tag">Cryptographic Hash JTI</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. ERP Quality & Invariants Lifecycle Standard */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot"></span>
            ERP Quality Assurance & Quarantine Lifecycle Standard
          </div>
          <div className="sales-pipeline-tag">Strict ISO 9001 & Double-Entry Invariants</div>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Inbound / Output</b>
              <span>PO goods receipt or finished work order output recorded</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Quarantine Hold</b>
              <span>Automated hold locks units from sales & assembly</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Sampling & QC</b>
              <span>Inspector performs dimensional & metallurgical checks</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Release to Stock</b>
              <span>Passed units enter available warehouse balance</span>
            </div>
          </div>

          <ArrowRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Scrap / Write-off</b>
              <span>Failed units post negative ledger adjustment</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Focused Linear Quality Inspection Modal */}
      {inspectingLot && (
        <div className="leads-modal-overlay" onClick={closeInspectModal}>
          <div className="leads-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="leads-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardCheck size={16} style={{ color: '#6366f1' }} />
                <h3>Quality Inspection · {inspectingLot.sku}</h3>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={closeInspectModal}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleModalInspectSubmit}>
              <div className="leads-modal-body">
                {/* Lot summary banner */}
                <div className="leads-modal-lead-summary">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <b>{inspectingLot.itemName}</b>
                    <span className="sales-badge-mono">{inspectingLot.sourceReference}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    <span>Location: <b>{inspectingLot.warehouseName} ({inspectingLot.warehouseCode})</b></span>
                    <span>Origin: <b>{formatSourceType(inspectingLot.sourceType)}</b></span>
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--sp-text-muted)' }}>Awaiting disposition:</span>
                    <span style={{ fontWeight: 600, color: '#d97706' }}>
                      {inspectingLot.remainingQuantity} of {inspectingLot.quantity} units
                    </span>
                  </div>
                </div>

                {/* Decision selector */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)', display: 'block', marginBottom: '8px' }}>
                    QUALITY DECISION
                  </label>
                  <div className="quality-decision-grid">
                    <button
                      type="button"
                      className={`quality-decision-btn pass ${modalOutcome === 'PASS' ? 'selected' : ''}`}
                      onClick={() => setModalOutcome('PASS')}
                    >
                      <div className="quality-decision-title">
                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                        <span>Pass & Release</span>
                      </div>
                      <div className="quality-decision-desc">
                        Releases stock from quarantine into available inventory.
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`quality-decision-btn fail ${modalOutcome === 'FAIL' ? 'selected' : ''}`}
                      onClick={() => setModalOutcome('FAIL')}
                    >
                      <div className="quality-decision-title">
                        <XCircle size={15} style={{ color: '#ef4444' }} />
                        <span>Fail & Scrap</span>
                      </div>
                      <div className="quality-decision-desc">
                        Scraps stock and records negative inventory write-off.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)' }}>
                      INSPECTION QUANTITY
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      Max: {inspectingLot.remainingQuantity} units
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={inspectingLot.remainingQuantity}
                    value={modalQuantity}
                    onChange={(e) => setModalQuantity(Math.min(inspectingLot.remainingQuantity, Math.max(1, Number(e.target.value) || 1)))}
                    required
                    style={{
                      width: '100%',
                      height: '34px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      padding: '0 10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  />
                  <div className="quality-qty-quick-btns">
                    <button
                      type="button"
                      className="quality-quick-btn"
                      onClick={() => setModalQuantity(inspectingLot.remainingQuantity)}
                    >
                      All ({inspectingLot.remainingQuantity})
                    </button>
                    {inspectingLot.remainingQuantity > 1 && (
                      <button
                        type="button"
                        className="quality-quick-btn"
                        onClick={() => setModalQuantity(Math.max(1, Math.floor(inspectingLot.remainingQuantity / 2)))}
                      >
                        50% ({Math.floor(inspectingLot.remainingQuantity / 2)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text-muted)', display: 'block', marginBottom: '6px' }}>
                    INSPECTION EVIDENCE / DEFECT NOTES
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="e.g. CMM dimensional tolerance verification passed (+/- 0.01mm) or surface pit defect found..."
                    style={{
                      width: '100%',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      padding: '8px 10px',
                      fontSize: '12px',
                      lineHeight: 1.4,
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div className="leads-modal-footer">
                <button
                  type="button"
                  className="sales-action-btn"
                  onClick={closeInspectModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`sales-action-btn ${modalOutcome === 'PASS' ? 'primary' : ''}`}
                  disabled={saving || modalQuantity <= 0}
                  style={modalOutcome === 'FAIL' ? { background: '#dc2626', color: '#fff', borderColor: '#b91c1c' } : {}}
                >
                  {saving ? (
                    'Recording…'
                  ) : modalOutcome === 'PASS' ? (
                    <>
                      <Check size={13} />
                      <span>Release {modalQuantity} Units</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      <span>Scrap {modalQuantity} Units</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
