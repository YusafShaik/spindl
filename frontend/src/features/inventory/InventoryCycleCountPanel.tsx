import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
  X,
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import type { CycleCountSession, CycleCountLine, WarehouseSummary } from '../../types/inventory';

interface InventoryCycleCountPanelProps {
  role?: string;
  notify: (message: string) => void;
  onPosted: () => Promise<void>;
}

export function InventoryCycleCountPanel({ role, notify, onPosted }: InventoryCycleCountPanelProps) {
  const [sessions, setSessions] = useState<CycleCountSession[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const canApprove = role !== undefined && ['OWNER', 'ADMIN', 'MANAGER'].includes(role);

  const load = async (): Promise<void> => {
    const [response, warehouseResponse] = await Promise.all([
      apiFetch(`${API}/inventory/cycle-counts`),
      apiFetch(`${API}/inventory/warehouses`),
    ]);
    if (!response.ok || !warehouseResponse.ok) {
      throw new Error('Could not load inventory count data');
    }
    const sessionData: CycleCountSession[] = await response.json();
    const locations: WarehouseSummary[] = await warehouseResponse.json();
    setSessions(sessionData);
    setWarehouses(locations);

    // Expand the active session by default
    if (sessionData.length > 0) {
      const activeOne = sessionData.find((s) => s.status === 'COUNTING' || s.status === 'REVIEW') || sessionData[0];
      setExpandedSessionIds((prev) => ({ ...prev, [activeOne.id]: true }));
    }

    if (!warehouseId && locations.length) {
      const defaultLoc = locations.find((w) => w.isDefault) || locations[0];
      setWarehouseId(defaultLoc.id);
    }
  };

  useEffect(() => {
    load()
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, []);

  const send = async (path: string, method = 'POST', payload?: unknown): Promise<CycleCountSession | null> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}${path}`, {
        method,
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail || body.message || 'Cycle count action failed');
      }
      await load();
      if (path.endsWith('/approve')) {
        await onPosted();
      }
      notify('Cycle count updated');
      return body;
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await send('/inventory/cycle-counts', 'POST', {
      name: form.get('name'),
      notes: form.get('notes') || null,
      warehouseId: warehouseId || null,
    });
    if (saved) {
      formElement.reset();
      setShowCreateModal(false);
      setExpandedSessionIds((prev) => ({ ...prev, [saved.id]: true }));
    }
  };

  const handleSaveLine = async (sessionId: string, lineId: string, valueStr: string) => {
    if (valueStr === undefined || valueStr === '') return;
    const countedQuantity = Number(valueStr);
    if (isNaN(countedQuantity) || countedQuantity < 0) {
      notify('Counted quantity must be a non-negative number');
      return;
    }
    setSavingLineId(lineId);
    try {
      const res = await apiFetch(`${API}/inventory/cycle-counts/${sessionId}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQuantity }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || body.message || 'Could not record count');
      }
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? (body as CycleCountSession) : s)));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingLineId(null);
    }
  };

  const handleFillAllWithBookStock = async (session: CycleCountSession) => {
    const uncountedLines = session.lines.filter((l) => l.countedQuantity == null);
    if (uncountedLines.length === 0) {
      notify('All lines are already counted.');
      return;
    }
    setSaving(true);
    try {
      for (const line of uncountedLines) {
        await apiFetch(`${API}/inventory/cycle-counts/${session.id}/lines/${line.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countedQuantity: line.systemQuantity }),
        });
      }
      await load();
      notify(`Pre-filled ${uncountedLines.length} items with book stock.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionIds((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const activeCountSession = useMemo(
    () => sessions.find((s) => s.status === 'COUNTING' || s.status === 'REVIEW'),
    [sessions]
  );

  // Top KPI metrics
  const activeCountingCount = useMemo(() => sessions.filter((s) => s.status === 'COUNTING').length, [sessions]);
  const inReviewCount = useMemo(() => sessions.filter((s) => s.status === 'REVIEW').length, [sessions]);
  const reconciledCount = useMemo(() => sessions.filter((s) => s.status === 'POSTED').length, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (statusFilter !== 'ALL' && session.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = session.name.toLowerCase().includes(q);
        const matchesWarehouse = (session.warehouseName || '').toLowerCase().includes(q);
        const matchesItems = session.lines.some(
          (l) => l.sku.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesWarehouse && !matchesItems) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Linear Authority KPI Summary Cards */}
      <div className="linear-kpi-grid">
        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Total Sessions</span>
            <span className="linear-kpi-icon"><ClipboardCheck size={14} /></span>
          </div>
          <div className="linear-kpi-value">{sessions.length}</div>
          <div className="linear-kpi-caption">All physical audits</div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Counting Active</span>
            <span className="linear-kpi-icon" style={{ color: activeCountingCount > 0 ? 'var(--sp-brand)' : undefined }}>
              <Layers size={14} />
            </span>
          </div>
          <div className="linear-kpi-value" style={{ color: activeCountingCount > 0 ? 'var(--sp-brand)' : undefined }}>
            {activeCountingCount}
          </div>
          <div className="linear-kpi-caption">
            {activeCountingCount > 0 ? 'Awaiting floor entry' : 'None in progress'}
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">In Review</span>
            <span className="linear-kpi-icon" style={{ color: inReviewCount > 0 ? '#b45309' : undefined }}>
              <AlertTriangle size={14} />
            </span>
          </div>
          <div className="linear-kpi-value" style={{ color: inReviewCount > 0 ? '#b45309' : undefined }}>
            {inReviewCount}
          </div>
          <div className="linear-kpi-caption">
            {inReviewCount > 0 ? 'Awaiting manager sign-off' : 'None pending review'}
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Reconciled</span>
            <span className="linear-kpi-icon" style={{ color: '#16a34a' }}>
              <CheckCircle2 size={14} />
            </span>
          </div>
          <div className="linear-kpi-value" style={{ color: reconciledCount > 0 ? '#16a34a' : undefined }}>
            {reconciledCount}
          </div>
          <div className="linear-kpi-caption">Variances booked to ledger</div>
        </div>
      </div>

      {/* 2. Linear Control Toolbar */}
      <div className="sales-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Filter size={14} style={{ color: 'var(--sp-text-muted)', flexShrink: 0 }} aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                height: '32px',
                padding: '0 28px 0 10px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--sp-border)',
                background: 'var(--sp-surface)',
                color: 'var(--sp-text)',
                cursor: 'pointer',
              }}
              aria-label="Filter count sessions by status"
            >
              <option value="ALL">All Statuses ({sessions.length})</option>
              <option value="COUNTING">Counting ({sessions.filter((s) => s.status === 'COUNTING').length})</option>
              <option value="REVIEW">Under Review ({sessions.filter((s) => s.status === 'REVIEW').length})</option>
              <option value="POSTED">Reconciled ({sessions.filter((s) => s.status === 'POSTED').length})</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="sales-search-box" style={{ maxWidth: '380px', width: '100%', flexShrink: 0 }}>
            <Search size={14} className="sales-search-icon" aria-hidden="true" />
            <input
              className="sales-search-input"
              placeholder="Search sessions by name, warehouse, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center' }}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {activeCountSession && (
            <span
              style={{
                fontSize: '11.5px',
                color: 'var(--sp-text-secondary)',
                background: 'var(--sp-surface-subtle)',
                border: '1px solid var(--sp-border)',
                borderRadius: '6px',
                padding: '4px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeCountSession.status === 'COUNTING' ? 'var(--sp-brand)' : '#b45309' }} />
              1 active session
            </span>
          )}

          <button
            type="button"
            className="button button-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ height: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>New count session</span>
          </button>
        </div>
      </div>

      {/* 3. New Session Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="record-modal"
            style={{ width: '480px', maxWidth: '95vw', padding: '24px', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--sp-text)', margin: '0 0 4px' }}>
                  New cycle count session
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', margin: 0 }}>
                  Initiate a physical inventory snapshot audit against book stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--sp-text-muted)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* When an active session is in progress, show clear guidance with jump action */}
            {activeCountSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      Active Count Session in Progress
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      Session <strong>“{activeCountSession.name}”</strong> at <strong>{activeCountSession.warehouseName}</strong> is currently {activeCountSession.status === 'COUNTING' ? 'under active counting on the floor' : 'awaiting manager approval'}.
                    </p>
                    <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      To prevent concurrent stock adjustment conflicts, Spindl ERP requires completing or cancelling the active session before initiating a new one.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--sp-border)' }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setExpandedSessionIds((prev) => ({ ...prev, [activeCountSession.id]: true }));
                      const el = document.getElementById(`session-${activeCountSession.id}`);
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Go to active session
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Session Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    name="name"
                    required
                    maxLength={120}
                    placeholder="e.g. Q4 Physical Stock Count"
                    autoFocus
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Warehouse Location <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Scope & Instructions <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>(Optional)</span>
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Audit all structural fasteners and flanges before monthly closing..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      color: 'var(--sp-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--sp-border)' }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={saving || !warehouseId}
                  >
                    {saving ? 'Creating…' : 'Start count session'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 4. Session Cards List */}
      {loading ? (
        <div className="sales-table-card" style={{ padding: '36px', textAlign: 'center' }}>
          <p style={{ color: 'var(--sp-text-muted)', fontSize: '13px' }}>Loading cycle count sessions…</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="sales-table-card" style={{ padding: '44px 20px', textAlign: 'center' }}>
          <ClipboardCheck size={36} style={{ margin: '0 auto 12px', color: 'var(--sp-text-muted)' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>No cycle count sessions found</div>
          <div style={{ fontSize: '12.5px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
            {searchQuery || statusFilter !== 'ALL'
              ? 'No sessions match your filter criteria.'
              : 'Start a new count session to audit physical inventory against book stock.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSessions.map((session) => {
            const isExpanded = !!expandedSessionIds[session.id];
            const uncountedCount = session.lines.filter((l) => l.countedQuantity == null).length;
            const varianceLines = session.lines.filter((l) => l.variance != null && l.variance !== 0);
            const totalDiscrepancyUnits = session.lines.reduce((sum, l) => sum + (l.variance || 0), 0);
            const totalCounted = session.lines.length - uncountedCount;

            return (
              <div
                key={session.id}
                id={`session-${session.id}`}
                className="sales-table-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '8px',
                  border: '1px solid var(--sp-border)',
                  overflow: 'hidden',
                  background: 'var(--sp-surface)',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: isExpanded ? '1px solid var(--sp-border)' : 'none',
                    background: 'var(--sp-surface)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '12px',
                  }}
                  onClick={() => toggleExpand(session.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--sp-text-muted)',
                      }}
                      aria-label={isExpanded ? 'Collapse session' : 'Expand session'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                          {session.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '1px 7px',
                            borderRadius: '4px',
                            background: 'var(--sp-surface-hover)',
                            border: '1px solid var(--sp-border)',
                            color: 'var(--sp-text-secondary)',
                          }}
                        >
                          {session.warehouseName}
                        </span>
                        <Status label={session.status} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-muted)', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span>{session.lines.length} inventory items</span>
                        <span>·</span>
                        <span>
                          Created {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {session.postedAt && (
                          <>
                            <span>·</span>
                            <span style={{ color: '#16a34a', fontWeight: 500 }}>
                              Reconciled {new Date(session.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </>
                        )}
                        {session.notes && (
                          <>
                            <span>·</span>
                            <span style={{ fontStyle: 'italic', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              “{session.notes}”
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions on Right */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {session.status === 'COUNTING' && (
                      <>
                        <button
                          type="button"
                          className="button button-primary"
                          disabled={saving || uncountedCount > 0}
                          onClick={() => send(`/inventory/cycle-counts/${session.id}/submit`)}
                          title={uncountedCount > 0 ? `Record counts for all items before submitting (${uncountedCount} remaining)` : 'Submit completed counts for review'}
                          style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
                        >
                          Submit for review{uncountedCount > 0 ? ` (${uncountedCount} left)` : ''}
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={saving}
                          onClick={() => {
                            if (window.confirm('Cancel this cycle count session? Unsubmitted counts will be discarded.')) {
                              send(`/inventory/cycle-counts/${session.id}/cancel`);
                            }
                          }}
                          style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {session.status === 'REVIEW' && canApprove && (
                      <>
                        <button
                          type="button"
                          className="button button-primary"
                          disabled={saving}
                          onClick={() => send(`/inventory/cycle-counts/${session.id}/approve`)}
                          style={{ height: '30px', padding: '0 12px', fontSize: '12px', background: '#16a34a', borderColor: '#16a34a' }}
                        >
                          Approve & post variances
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={saving}
                          onClick={() => {
                            if (window.confirm('Cancel this cycle count session?')) {
                              send(`/inventory/cycle-counts/${session.id}/cancel`);
                            }
                          }}
                          style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {session.status === 'POSTED' && (
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Reconciled
                      </span>
                    )}
                  </div>
                </div>

                {/* Session Table & Lines */}
                {isExpanded && (
                  <div>
                    {/* Review Banner if under review */}
                    {session.status === 'REVIEW' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 18px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                          fontSize: '12px',
                          color: '#b45309',
                        }}
                      >
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                        <span>
                          Counts are frozen and awaiting management approval. Approving will automatically update warehouse stock balances and book reconciliation movements in the ledger.
                        </span>
                      </div>
                    )}

                    {/* Compact Linear Telemetry Sub-bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 18px',
                        background: 'var(--sp-surface-hover)',
                        borderBottom: '1px solid var(--sp-border)',
                        fontSize: '12px',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span>
                          Items Counted:{' '}
                          <strong style={{ color: 'var(--sp-text)' }}>
                            {totalCounted} of {session.lines.length}
                          </strong>
                        </span>
                        <span>
                          Discrepancies:{' '}
                          <strong style={{ color: varianceLines.length > 0 ? '#b45309' : 'var(--sp-text)' }}>
                            {varianceLines.length} {varianceLines.length === 1 ? 'item' : 'items'}
                          </strong>
                        </span>
                        <span>
                          Net Variance:{' '}
                          <span
                            style={{
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: totalDiscrepancyUnits === 0 ? '#16a34a' : totalDiscrepancyUnits > 0 ? 'var(--sp-brand)' : '#dc2626',
                            }}
                          >
                            {totalDiscrepancyUnits > 0 ? `+${totalDiscrepancyUnits}` : totalDiscrepancyUnits} units
                          </span>
                        </span>
                      </div>

                      {/* Quick Pre-fill Helper for Counting */}
                      {session.status === 'COUNTING' && uncountedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleFillAllWithBookStock(session)}
                          disabled={saving}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'var(--sp-surface)',
                            border: '1px solid var(--sp-border)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11.5px',
                            color: 'var(--sp-text-secondary)',
                            cursor: 'pointer',
                          }}
                          title="Set counted quantity = system quantity for remaining uncounted items"
                        >
                          <Copy size={11} />
                          <span>Pre-fill remaining ({uncountedCount}) with book stock</span>
                        </button>
                      )}
                    </div>

                    {/* Linear Lines Table */}
                    <div className="sales-table-scroll">
                      <table className="sales-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: '240px' }}>ITEM & SPECIFICATION</th>
                            <th style={{ width: '140px' }}>SKU</th>
                            <th style={{ width: '140px', textAlign: 'right' }}>SYSTEM ON-HAND</th>
                            <th style={{ width: '180px', textAlign: 'right' }}>PHYSICAL COUNT</th>
                            <th style={{ width: '140px', textAlign: 'right' }}>VARIANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.lines.map((line) => {
                            const isBeingEdited = inputValues[line.id] !== undefined;
                            const currentVal = isBeingEdited ? inputValues[line.id] : (line.countedQuantity ?? '');
                            const isSavingThis = savingLineId === line.id;

                            return (
                              <tr key={line.id} className="sales-row">
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <strong style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                                      {line.itemName}
                                    </strong>
                                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                      Unit: {line.unit}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className="sales-ref-badge"
                                    style={{
                                      fontSize: '11px',
                                      fontFamily: 'var(--sp-font-mono, monospace)',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {line.sku}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '12.5px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                                    {line.systemQuantity.toLocaleString()}
                                  </span>{' '}
                                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>{line.unit}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {session.status === 'COUNTING' ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        value={currentVal}
                                        onChange={(e) =>
                                          setInputValues((prev) => ({ ...prev, [line.id]: e.target.value }))
                                        }
                                        onBlur={(e) => {
                                          if (e.target.value !== '' && Number(e.target.value) !== line.countedQuantity) {
                                            handleSaveLine(session.id, line.id, e.target.value);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveLine(session.id, line.id, (e.target as HTMLInputElement).value);
                                            (e.target as HTMLInputElement).blur();
                                          }
                                        }}
                                        placeholder={`e.g. ${line.systemQuantity}`}
                                        disabled={isSavingThis}
                                        style={{
                                          width: '100px',
                                          height: '30px',
                                          padding: '0 8px',
                                          fontSize: '12px',
                                          textAlign: 'right',
                                          borderRadius: '6px',
                                          border: isSavingThis ? '1px solid var(--sp-brand)' : '1px solid var(--sp-border)',
                                          background: 'var(--sp-surface)',
                                          color: 'var(--sp-text)',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      />
                                      {/* Quick Match Helper Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInputValues((prev) => ({ ...prev, [line.id]: String(line.systemQuantity) }));
                                          handleSaveLine(session.id, line.id, String(line.systemQuantity));
                                        }}
                                        title={`Match book quantity (${line.systemQuantity})`}
                                        style={{
                                          background: 'none',
                                          border: '1px solid var(--sp-border)',
                                          borderRadius: '4px',
                                          padding: '2px 5px',
                                          fontSize: '10px',
                                          color: 'var(--sp-text-muted)',
                                          cursor: 'pointer',
                                          lineHeight: 1,
                                        }}
                                      >
                                        =
                                      </button>
                                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', minWidth: '22px' }}>
                                        {line.unit}
                                      </span>
                                      {isSavingThis && (
                                        <RefreshCw size={11} className="spin" style={{ color: 'var(--sp-brand)' }} />
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '12.5px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                                      {line.countedQuantity == null ? '—' : `${line.countedQuantity.toLocaleString()} ${line.unit}`}
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {line.variance == null ? (
                                    <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>—</span>
                                  ) : line.variance === 0 ? (
                                    <span
                                      className="status status-green"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                      }}
                                    >
                                      <Check size={11} /> Match
                                    </span>
                                  ) : line.variance > 0 ? (
                                    <span
                                      className="status status-blue"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      +{line.variance} surplus
                                    </span>
                                  ) : (
                                    <span
                                      className="status status-red"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {line.variance} deficit
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
