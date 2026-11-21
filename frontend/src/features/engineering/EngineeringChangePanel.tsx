import { useState, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileCheck,
  FileText,
  Flame,
  GitCommit,
  GitPullRequest,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
  Zap
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { Status } from '../../components/ui/Status';
import type { ItemSummary } from '../../types/inventory';
import type {
  EngineeringChangeOrder,
  EcoDetail,
  EcoMetrics,
  DepartmentType,
  ChangeSeverity,
  ProposedBomLineInput,
  ProposeEcoRequest,
  SubmitSignOffRequest,
  ImplementEcoRequest
} from '../../types/engineering';

interface EngineeringChangePanelProps {
  items: ItemSummary[];
  role?: string;
  notify: (message: string) => void;
}

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

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  align?: 'left' | 'center';
}

function StyledTooltip({ content, children, align = 'center' }: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!targetRef.current) return;
    const rect = targetRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top - 7,
      left: align === 'left' ? rect.left : rect.left + rect.width / 2,
    });
  };

  const handleMouseLeave = () => {
    setCoords(null);
  };

  return (
    <div
      ref={targetRef}
      className="sp-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {coords && content && createPortal(
        <div
          className={`sp-styled-tooltip-portal ${align === 'left' ? 'align-left' : ''}`}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: align === 'left' ? 'translateY(-100%)' : 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}

export function EngineeringChangePanel({ items, role, notify }: EngineeringChangePanelProps) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Core domain data
  const [ecos, setEcos] = useState<EngineeringChangeOrder[]>([]);
  const [metrics, setMetrics] = useState<EcoMetrics | null>(null);
  const [selectedEcoId, setSelectedEcoId] = useState<string | null>(null);
  const [selectedEcoDetail, setSelectedEcoDetail] = useState<EcoDetail | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Dialogs
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [isImplementModalOpen, setIsImplementModalOpen] = useState(false);

  // Create Form State
  const [formFinishedItemId, setFormFinishedItemId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formChangeSeverity, setFormChangeSeverity] = useState<ChangeSeverity>('MAJOR');
  const [formCutoverDate, setFormCutoverDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [formProposedLines, setFormProposedLines] = useState<ProposedBomLineInput[]>([]);

  // Sign-Off Form State
  const [signDepartment, setSignDepartment] = useState<DepartmentType>('ENGINEERING');
  const [signStatus, setSignStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [signComments, setSignComments] = useState('');

  // Implement / Cutover Form State
  const [cutoverDisposition, setCutoverDisposition] = useState('USE_EXISTING_FIRST');
  const [cutoverNotes, setCutoverNotes] = useState('Production cutover verified & active BOM revision incremented.');

  // Load ECO registers and telemetry
  const loadData = async () => {
    setLoading(true);
    try {
      const [ecosRes, metricsRes] = await Promise.all([
        apiFetch(`${API}/engineering/ecos`),
        apiFetch(`${API}/engineering/ecos/metrics`)
      ]);

      if (ecosRes.ok) {
        const ecosData: EngineeringChangeOrder[] = await ecosRes.json();
        setEcos(ecosData);
        // If an eco was already selected, refresh it
        if (selectedEcoId) {
          const detailRes = await apiFetch(`${API}/engineering/ecos/${selectedEcoId}`);
          if (detailRes.ok) {
            setSelectedEcoDetail(await detailRes.json());
          }
        }
      }
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }
    } catch (err) {
      console.error('Failed to load ECO data:', err);
      notify('Failed to refresh engineering change order registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Select an ECO to load detail
  const selectEco = async (ecoId: string) => {
    setSelectedEcoId(ecoId);
    try {
      const detailRes = await apiFetch(`${API}/engineering/ecos/${ecoId}`);
      if (detailRes.ok) {
        setSelectedEcoDetail(await detailRes.json());
      }
    } catch (err) {
      console.error('Failed to load ECO details:', err);
    }
  };

  // Filtered ECO list
  const filteredEcos = useMemo(() => {
    return ecos.filter(e => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.ecoNumber.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.finishedSku.toLowerCase().includes(q) ||
        e.finishedItemName.toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [ecos, searchQuery, statusFilter]);

  // Handle Propose ECO
  const handleProposeEco = async (e: FormEvent) => {
    e.preventDefault();
    if (!formFinishedItemId) {
      notify('Please select a finished product for BOM revision');
      return;
    }
    if (!formTitle.trim()) {
      notify('Please enter an ECO title');
      return;
    }

    try {
      setBusy(true);
      const payload: ProposeEcoRequest = {
        finishedItemId: formFinishedItemId,
        title: formTitle,
        reason: formReason,
        changeSeverity: formChangeSeverity,
        effectiveCutoverDate: formCutoverDate,
        proposedLines: formProposedLines
      };

      const res = await apiFetch(`${API}/engineering/ecos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to propose ECO');
      }

      const created: EngineeringChangeOrder = await res.json();
      notify(`Engineering Change Order ${created.ecoNumber} proposed successfully!`);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormReason('');
      setFormProposedLines([]);
      await loadData();
      selectEco(created.id);
    } catch (err: any) {
      notify(err.message || 'Error proposing ECO');
    } finally {
      setBusy(false);
    }
  };

  // Handle Sign-Off Review
  const handleSubmitSignOff = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEcoId) return;

    try {
      setBusy(true);
      const payload: SubmitSignOffRequest = {
        department: signDepartment,
        status: signStatus,
        comments: signComments
      };

      const res = await apiFetch(`${API}/engineering/ecos/${selectedEcoId}/sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to submit sign-off');
      }

      const updated: EngineeringChangeOrder = await res.json();
      notify(`Departmental sign-off recorded for ${signDepartment}. Status: ${updated.status}`);
      setIsSignOffModalOpen(false);
      setSignComments('');
      await loadData();
      selectEco(selectedEcoId);
    } catch (err: any) {
      notify(err.message || 'Error submitting sign-off');
    } finally {
      setBusy(false);
    }
  };

  // Handle Cutover / Implementation
  const handleImplementCutover = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEcoId) return;

    try {
      setBusy(true);
      const payload: ImplementEcoRequest = {
        existingInventoryDisposition: cutoverDisposition,
        implementationNotes: cutoverNotes
      };

      const res = await apiFetch(`${API}/engineering/ecos/${selectedEcoId}/implement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to implement ECO cutover');
      }

      const updated: EngineeringChangeOrder = await res.json();
      notify(`ECO ${updated.ecoNumber} implemented! Revision ${updated.targetRevision} is now active on the shop floor.`);
      setIsImplementModalOpen(false);
      await loadData();
      selectEco(selectedEcoId);
    } catch (err: any) {
      notify(err.message || 'Error implementing cutover');
    } finally {
      setBusy(false);
    }
  };

  // Helper labels
  const getDeptRoleDefault = (dept: DepartmentType) => {
    switch (dept) {
      case 'ENGINEERING': return 'Chief Design Engineer';
      case 'MANUFACTURING': return 'Plant Operations Lead';
      case 'QUALITY': return 'ISO-9001 Quality Lead';
      case 'FINANCE': return 'Cost Accounting Lead';
    }
  };

  const activeEcosCount = ecos.filter(e => e.status === 'UNDER_REVIEW' || e.status === 'APPROVED').length;
  const pendingSignOffsCount = ecos.filter(e => e.status === 'UNDER_REVIEW').length;
  const approvedCutoverCount = ecos.filter(e => e.status === 'APPROVED').length;
  const criticalCount = ecos.filter(e => e.changeSeverity === 'CRITICAL').length;

  return (
    <div className="sales-screen-layout">
      {selectedEcoDetail ? (
        /* =========================================================================
           AUTHENTIC LINEAR ISSUE DETAIL VIEW
           Full screen takeover matching MRP shortage detail view
           ========================================================================= */
        <div className="linear-detail-container">
          {/* Top Bar with Breadcrumbs & Actions */}
          <div className="linear-detail-topbar">
            <div className="linear-detail-breadcrumbs">
              <button
                type="button"
                className="linear-crumb-back"
                onClick={() => {
                  setSelectedEcoDetail(null);
                  setSelectedEcoId(null);
                }}
              >
                <ArrowLeft size={13} />
                <span>Engineering (ECO)</span>
              </button>
              <span className="linear-crumb-sep">/</span>
              <span className="linear-crumb-id">{selectedEcoDetail.ecoNumber}</span>
            </div>

            <div className="linear-detail-top-actions">
              {selectedEcoDetail.status === 'UNDER_REVIEW' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={() => setIsSignOffModalOpen(true)}
                  disabled={busy}
                >
                  <UserCheck size={12} />
                  <span>Record Department Sign-Off</span>
                </button>
              )}

              {selectedEcoDetail.status === 'APPROVED' && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={() => setIsImplementModalOpen(true)}
                  disabled={busy}
                >
                  <Zap size={12} />
                  <span>Execute Production Cutover</span>
                </button>
              )}

              {selectedEcoDetail.status === 'IMPLEMENTED' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sp-success)' }}>
                  <CheckCircle2 size={14} />
                  <span>Cutover Complete · Revision <strong>{selectedEcoDetail.targetRevision}</strong> Active</span>
                </div>
              )}
            </div>
          </div>

          {/* 2-Column Linear Layout */}
          <div className="linear-detail-grid">
            {/* Left Column: Narrative & Detailed Data */}
            <div className="linear-detail-content">
              {/* Title & Badges */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="order-number-pill">
                    {selectedEcoDetail.ecoNumber}
                  </span>
                  <Status label={selectedEcoDetail.status} />
                  <span className={`priority-tag priority-${selectedEcoDetail.changeSeverity === 'CRITICAL' ? 'urgent' : selectedEcoDetail.changeSeverity === 'MAJOR' ? 'high' : 'medium'}`}>
                    {selectedEcoDetail.changeSeverity} Severity
                  </span>
                  <span className="sales-warehouse-pill" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    Revision {selectedEcoDetail.baseRevision} → {selectedEcoDetail.targetRevision}
                  </span>
                </div>
                <h1 className="linear-detail-h1">{selectedEcoDetail.title}</h1>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--sp-text-muted)' }}>
                  Target Product: <strong style={{ color: 'var(--sp-text)' }}>{selectedEcoDetail.finishedItemName}</strong> · SKU: <strong style={{ color: 'var(--sp-text)' }}>{selectedEcoDetail.finishedSku}</strong>
                </p>
              </div>

              {/* Linear Telemetry KPI Grid */}
              <div style={{ padding: '14px 16px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Severity Classification</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>
                    {selectedEcoDetail.changeSeverity}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                    {selectedEcoDetail.changeSeverity === 'CRITICAL' ? 'Safety / Field warranty' : 'Form, fit, or function change'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>BOM Revision Shift</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-brand)', marginTop: '2px' }}>
                    {selectedEcoDetail.baseRevision} → {selectedEcoDetail.targetRevision}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                    Target production BOM
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Effective Cutover</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sp-warning)', marginTop: '2px' }}>
                    {formatDate(selectedEcoDetail.effectiveCutoverDate)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                    Scheduled shop floor release
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Sign-Off Stage-Gates</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: selectedEcoDetail.signOffs?.filter(s => s.status === 'APPROVED').length === selectedEcoDetail.signOffs?.length ? 'var(--sp-success)' : 'var(--sp-warning)', marginTop: '2px' }}>
                    {selectedEcoDetail.signOffs?.filter(s => s.status === 'APPROVED').length || 0} / {selectedEcoDetail.signOffs?.length || 0} Signed
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                    4 cross-functional gates
                  </div>
                </div>
              </div>

              {/* Card 1: Engineering Justification & Problem Description */}
              <div className="linear-sublines-card">
                <div className="linear-sublines-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Engineering Justification & Problem Description</span>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', fontSize: '13px', lineHeight: 1.6, color: 'var(--sp-text)' }}>
                  {selectedEcoDetail.reason || 'No engineering justification provided.'}
                </div>
              </div>

              {/* Card 2: BOM Component Redline Changes */}
              <div className="linear-sublines-card">
                <div className="linear-sublines-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GitCommit size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>BOM Component Redline Changes ({selectedEcoDetail.diffLines?.length || 0} Lines)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="sales-sub-highlight">
                      +{selectedEcoDetail.diffLines?.filter(l => l.changeType === 'ADD').length || 0} Added
                    </span>
                    <span className="sales-sub-warning">
                      ~{selectedEcoDetail.diffLines?.filter(l => l.changeType === 'QUANTITY_CHANGE').length || 0} Modified
                    </span>
                    <span className="sales-sub-warning" style={{ color: 'var(--sp-danger)' }}>
                      -{selectedEcoDetail.diffLines?.filter(l => l.changeType === 'REMOVE').length || 0} Removed
                    </span>
                  </div>
                </div>

                {(!selectedEcoDetail.diffLines || selectedEcoDetail.diffLines.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                    No component redline changes recorded for this change order.
                  </div>
                ) : (
                  <div>
                    {selectedEcoDetail.diffLines.map((line) => (
                      <div key={line.id} className="linear-subline-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            className={
                              line.changeType === 'ADD'
                                ? 'sales-sub-highlight'
                                : line.changeType === 'REMOVE'
                                ? 'sales-sub-warning'
                                : 'sales-warehouse-pill'
                            }
                            style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 600 }}
                          >
                            {line.changeType}
                          </span>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                              {line.componentName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span className="sales-ref-badge" style={{ fontSize: '10.5px' }}>{line.componentSku}</span>
                              {line.notes && <span>· {line.notes}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          <span style={{ color: line.changeType === 'REMOVE' ? 'var(--sp-danger)' : 'var(--sp-text-muted)', textDecoration: line.changeType === 'REMOVE' ? 'line-through' : undefined }}>
                            {line.oldQuantity} {line.componentUnit}
                          </span>
                          {' → '}
                          <span style={{ fontWeight: 600, color: line.changeType === 'ADD' ? 'var(--sp-success)' : 'var(--sp-text)' }}>
                            {line.newQuantity} {line.componentUnit}
                          </span>
                          {line.newScrapPercent !== line.oldScrapPercent && (
                            <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                              Scrap: {line.oldScrapPercent}% → {line.newScrapPercent}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 3: Departmental Sign-Off Ledger */}
              <div className="linear-sublines-card">
                <div className="linear-sublines-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={13} style={{ color: 'var(--sp-brand)' }} />
                    <span>Departmental Sign-Off Ledger ({selectedEcoDetail.signOffs?.filter(s => s.status === 'APPROVED').length || 0}/{selectedEcoDetail.signOffs?.length || 0} Completed)</span>
                  </div>
                  {selectedEcoDetail.status === 'UNDER_REVIEW' && (
                    <button
                      type="button"
                      className="sales-action-btn primary"
                      style={{ height: '22px', fontSize: '11px', padding: '0 8px' }}
                      onClick={() => setIsSignOffModalOpen(true)}
                    >
                      <Plus size={11} />
                      <span>Record Sign-Off</span>
                    </button>
                  )}
                </div>

                {(!selectedEcoDetail.signOffs || selectedEcoDetail.signOffs.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                    No sign-offs recorded.
                  </div>
                ) : (
                  <div>
                    {selectedEcoDetail.signOffs.map((s) => (
                      <div key={s.id} className="linear-subline-item" style={{ alignItems: 'flex-start', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '12.5px', minWidth: '100px', textTransform: 'capitalize' }}>
                              {s.department.toLowerCase()}
                            </span>
                            <Status label={s.status} />
                            <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                              Role: <strong>{s.signOffRole || getDeptRoleDefault(s.department)}</strong>
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
                            {s.comments ? (
                              <span style={{ fontStyle: 'italic' }}>“{s.comments}”</span>
                            ) : (
                              <span style={{ color: 'var(--sp-text-muted)' }}>
                                {s.status === 'APPROVED' ? 'Approved without additional conditions.' : 'Awaiting formal departmental review.'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                            {s.approverName || '—'}
                          </span>
                          {s.approvedAt && (
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatDate(s.approvedAt)}
                            </span>
                          )}
                          {s.status === 'PENDING' && selectedEcoDetail.status === 'UNDER_REVIEW' && (
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              style={{ height: '20px', padding: '0 6px', fontSize: '10.5px', marginTop: '2px' }}
                              onClick={() => {
                                setSignDepartment(s.department);
                                setIsSignOffModalOpen(true);
                              }}
                            >
                              <span>Sign Off</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 4: Cutover Execution Details (if implemented) */}
              {selectedEcoDetail.status === 'IMPLEMENTED' && (
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--sp-success)' }} />
                      <span>Shop Floor Cutover & Active BOM Execution</span>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Cutover Timestamp</div>
                      <div style={{ fontWeight: 600, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(selectedEcoDetail.implementedAt)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Active Production BOM</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>
                        Revision {selectedEcoDetail.implementedBomRevision || selectedEcoDetail.targetRevision} (Live)
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>Cutover Implementation Notes</div>
                      <div style={{ marginTop: '2px', color: 'var(--sp-text-secondary)', lineHeight: 1.5 }}>
                        {selectedEcoDetail.implementationNotes || 'Active BOM revision incremented in production database.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Properties Sidebar */}
            <div className="linear-properties-sidebar">
              <div className="linear-properties-card">
                <div className="linear-properties-title">Properties</div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Status</span>
                  <Status label={selectedEcoDetail.status} />
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Severity</span>
                  <span className={`priority-tag priority-${selectedEcoDetail.changeSeverity === 'CRITICAL' ? 'urgent' : selectedEcoDetail.changeSeverity === 'MAJOR' ? 'high' : 'medium'}`}>
                    {selectedEcoDetail.changeSeverity}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Target Product</span>
                  <span className="linear-property-value" title={selectedEcoDetail.finishedItemName}>
                    {selectedEcoDetail.finishedSku}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">BOM Revision</span>
                  <span className="linear-property-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedEcoDetail.baseRevision} → {selectedEcoDetail.targetRevision}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Cutover Target</span>
                  <span className="linear-property-value" style={{ fontWeight: 600, color: 'var(--sp-warning)' }}>
                    {formatDate(selectedEcoDetail.effectiveCutoverDate)}
                  </span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Created By</span>
                  <span className="linear-property-value">{selectedEcoDetail.createdByName}</span>
                </div>

                <div className="linear-property-row">
                  <span className="linear-property-label">Created Date</span>
                  <span className="linear-property-value">
                    {formatDate(selectedEcoDetail.createdAt)}
                  </span>
                </div>

                {selectedEcoDetail.implementedAt && (
                  <div className="linear-property-row">
                    <span className="linear-property-label">Implemented</span>
                    <span className="linear-property-value" style={{ color: 'var(--sp-success)' }}>
                      {formatDate(selectedEcoDetail.implementedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions Card in Sidebar */}
              {(selectedEcoDetail.status === 'UNDER_REVIEW' || selectedEcoDetail.status === 'APPROVED') && (
                <div className="linear-properties-card">
                  <div className="linear-properties-title">Actions</div>
                  {selectedEcoDetail.status === 'UNDER_REVIEW' && (
                    <button
                      type="button"
                      className="sales-action-btn primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setIsSignOffModalOpen(true)}
                    >
                      <UserCheck size={12} />
                      <span>Record Sign-Off</span>
                    </button>
                  )}
                  {selectedEcoDetail.status === 'APPROVED' && (
                    <button
                      type="button"
                      className="sales-action-btn primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setIsImplementModalOpen(true)}
                    >
                      <Zap size={12} />
                      <span>Execute Cutover</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Linear Executive Telemetry Metric Strip */}
          <div className="linear-kpi-grid">
            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Active ECO Pipeline</span>
                <GitPullRequest size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.activeEcos ?? activeEcosCount} Active
              </div>
              <div className="linear-kpi-caption">
                Under review or approved for release
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Pending Sign-Offs</span>
                <UserCheck size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.pendingSignOffs ?? pendingSignOffsCount} Stage-gates
              </div>
              <div className="linear-kpi-caption">
                Multi-department stakeholder sign-offs
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Approved for Cutover</span>
                <FileCheck size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.approvedPendingCutover ?? approvedCutoverCount} Approved
              </div>
              <div className="linear-kpi-caption">
                100% signed, ready to increment BOM
              </div>
            </div>

            <div className="linear-kpi-card">
              <div className="linear-kpi-top">
                <span className="linear-kpi-title">Critical Severity</span>
                <Flame size={14} className="linear-kpi-icon" />
              </div>
              <div className="linear-kpi-value">
                {metrics?.criticalSeverityCount ?? criticalCount} Critical
              </div>
              <div className="linear-kpi-caption">
                Field warranty or safety redesigns
              </div>
            </div>
          </div>

          {/* 2. Top Header & Action Strip */}
          <div className="sales-subnav-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={14} style={{ color: 'var(--sp-brand)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>Change Orders Register</span>
              <span className="sales-subnav-badge">{ecos.length}</span>
            </div>

            <div className="sales-subnav-actions">
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={loadData}
                disabled={loading || busy}
                title="Refresh ECO Registers"
              >
                <RotateCcw size={12} className={loading || busy ? 'spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                className="sales-action-btn primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus size={12} />
                <span>Propose ECO</span>
              </button>
            </div>
          </div>

          {/* 3. Toolbar & High-Density Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Toolbar */}
            <div className="sales-toolbar">
              <div className="sales-pill-group">
                <button
                  type="button"
                  className={`sales-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  <span>All</span>
                  <span className="sales-pill-count">{ecos.length}</span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${statusFilter === 'UNDER_REVIEW' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('UNDER_REVIEW')}
                >
                  <span>Under Review</span>
                  <span className="sales-pill-count">
                    {ecos.filter((e) => e.status === 'UNDER_REVIEW').length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${statusFilter === 'APPROVED' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('APPROVED')}
                >
                  <span>Approved</span>
                  <span className="sales-pill-count">
                    {ecos.filter((e) => e.status === 'APPROVED').length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${statusFilter === 'IMPLEMENTED' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('IMPLEMENTED')}
                >
                  <span>Implemented</span>
                  <span className="sales-pill-count">
                    {ecos.filter((e) => e.status === 'IMPLEMENTED').length}
                  </span>
                </button>
              </div>

              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  className="sales-search-input"
                  placeholder="Filter by ECO #, title, SKU, or reason…"
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

            {/* High-Density Redesigned ECO Table (Zero Overlap, Guaranteed Fit, Styled Body Tooltips) */}
            <div className="sales-table-card">
              <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>ECO Ref</th>
                    <th>Change Title</th>
                    <th style={{ width: '210px' }}>Target Product</th>
                    <th style={{ width: '105px' }}>Revision</th>
                    <th style={{ width: '95px' }}>Cutover</th>
                    <th style={{ width: '95px' }}>Sign-Offs</th>
                    <th style={{ width: '105px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEcos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                        No engineering change orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredEcos.map((eco) => {
                      const isSelected = eco.id === selectedEcoId;
                      const formattedCutover = formatDate(eco.effectiveCutoverDate);

                      return (
                        <tr
                          key={eco.id}
                          className="sales-row production-clickable-row"
                          onClick={() => selectEco(eco.id)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--sp-brand-soft)' : undefined
                          }}
                        >
                          {/* ECO Ref with interactive pill & priority tag */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <StyledTooltip content={`ECO #${eco.ecoNumber} · ${eco.changeSeverity} Severity — Click to inspect details`}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="order-number-pill interactive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectEco(eco.id);
                                  }}
                                  title={`Inspect ${eco.ecoNumber}`}
                                >
                                  <span>{eco.ecoNumber}</span>
                                  <ArrowUpRight size={11} className="order-link-arrow" />
                                </button>
                                <span className={`priority-tag priority-${eco.changeSeverity === 'CRITICAL' ? 'urgent' : eco.changeSeverity === 'MAJOR' ? 'high' : 'medium'}`}>
                                  {eco.changeSeverity}
                                </span>
                              </div>
                            </StyledTooltip>
                          </td>

                          {/* Change Title with Styled Tooltip */}
                          <td style={{ overflow: 'hidden' }}>
                            <StyledTooltip content={eco.title} align="left">
                              <span
                                style={{
                                  fontWeight: 500,
                                  color: 'var(--sp-text)',
                                  fontSize: '12.5px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                  maxWidth: '100%'
                                }}
                              >
                                {eco.title}
                              </span>
                            </StyledTooltip>
                          </td>

                          {/* Target Product with SKU Badge and Styled Tooltip */}
                          <td style={{ overflow: 'hidden' }}>
                            <StyledTooltip
                              align="left"
                              content={
                                <div>
                                  <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{eco.finishedItemName}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10.5px' }}>
                                    SKU: {eco.finishedSku} · Base Revision: {eco.baseRevision}
                                  </div>
                                </div>
                              }
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                                <span className="sales-ref-badge" style={{ fontSize: '10.5px', flexShrink: 0 }}>
                                  {eco.finishedSku}
                                </span>
                                <span
                                  style={{
                                    fontWeight: 500,
                                    color: 'var(--sp-text)',
                                    fontSize: '12px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {eco.finishedItemName}
                                </span>
                              </div>
                            </StyledTooltip>
                          </td>

                          {/* Revision Shift */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <StyledTooltip content={`BOM revision increments from ${eco.baseRevision} to ${eco.targetRevision} upon cutover`}>
                              <span className="sales-warehouse-pill" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                                {eco.baseRevision} → {eco.targetRevision}
                              </span>
                            </StyledTooltip>
                          </td>

                          {/* Cutover Target Date */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <StyledTooltip content={`Effective shop floor cutover: ${formattedCutover}`}>
                              <div style={{ fontSize: '12px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {formattedCutover}
                              </div>
                            </StyledTooltip>
                          </td>

                          {/* Department Sign-Offs */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <StyledTooltip content={`${eco.signOffsCompleted} of ${eco.totalSignOffs} departmental sign-offs recorded`}>
                              <span
                                className={
                                  eco.signOffsCompleted === eco.totalSignOffs
                                    ? 'sales-sub-highlight'
                                    : 'sales-sub-warning'
                                }
                                style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}
                              >
                                {eco.signOffsCompleted}/{eco.totalSignOffs} Signed
                              </span>
                            </StyledTooltip>
                          </td>

                          {/* Status */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <StyledTooltip content={`Current ECO lifecycle state: ${eco.status}`}>
                              <Status label={eco.status} />
                            </StyledTooltip>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL: PROPOSE NEW ECO */}
      {isCreateModalOpen && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setIsCreateModalOpen(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Propose Engineering Change Order (ECO)</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Initiate formal PLM revision governance for an engineering bill of materials.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleProposeEco} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Target Finished Item for Revision
                  <select
                    value={formFinishedItemId}
                    onChange={(e) => setFormFinishedItemId(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="">Choose item to redesign…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} · {i.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  ECO Change Title
                  <input
                    type="text"
                    placeholder="e.g. Upgrade actuator shaft to aerospace Grade 5 Titanium"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Engineering Severity
                    <select
                      value={formChangeSeverity}
                      onChange={(e) => setFormChangeSeverity(e.target.value as ChangeSeverity)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                    >
                      <option value="MINOR">MINOR (Drawing / Tolerance Fix)</option>
                      <option value="MAJOR">MAJOR (Material / Component Change)</option>
                      <option value="CRITICAL">CRITICAL (Safety / Regulatory Rush)</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Target Cutover Date
                    <input
                      type="date"
                      value={formCutoverDate}
                      onChange={(e) => setFormCutoverDate(e.target.value)}
                      required
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Engineering Justification / Failure Reason
                  <textarea
                    rows={3}
                    placeholder="Detailed explanation of failure mode, vendor obsolescence, or weight reduction rationale…"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    required
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? 'Proposing…' : 'Submit ECO Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT SIGN-OFF REVIEW */}
      {isSignOffModalOpen && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setIsSignOffModalOpen(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Digital Department Sign-Off</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Record review gate for {selectedEcoDetail?.ecoNumber || 'ECO'}.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setIsSignOffModalOpen(false)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmitSignOff} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Department Discipline
                  <select
                    value={signDepartment}
                    onChange={(e) => setSignDepartment(e.target.value as DepartmentType)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="ENGINEERING">ENGINEERING (Design Authority)</option>
                    <option value="MANUFACTURING">MANUFACTURING (Tooling & Fixtures)</option>
                    <option value="QUALITY">QUALITY (ISO-9001 Compliance)</option>
                    <option value="FINANCE">FINANCE (Unit Cost & Margins)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Review Disposition
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className={`sales-pill-btn ${signStatus === 'APPROVED' ? 'active' : ''}`}
                      onClick={() => setSignStatus('APPROVED')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Check size={12} />
                      <span>Approve Change</span>
                    </button>
                    <button
                      type="button"
                      className={`sales-pill-btn ${signStatus === 'REJECTED' ? 'active' : ''}`}
                      onClick={() => setSignStatus('REJECTED')}
                      style={{ flex: 1, justifyContent: 'center', color: signStatus === 'REJECTED' ? 'var(--sp-danger)' : undefined }}
                    >
                      <X size={12} />
                      <span>Reject Change</span>
                    </button>
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Approver Comments & Engineering Evidence
                  <textarea
                    rows={3}
                    placeholder="Sign-off notes, tooling verification status, or rejection rationale…"
                    value={signComments}
                    onChange={(e) => setSignComments(e.target.value)}
                    required
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsSignOffModalOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? 'Submitting…' : 'Record Sign-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPLEMENT CUTOVER */}
      {isImplementModalOpen && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setIsImplementModalOpen(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Execute Active BOM Revision Cutover</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Cutover {selectedEcoDetail?.ecoNumber} from {selectedEcoDetail?.baseRevision} to {selectedEcoDetail?.targetRevision}.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setIsImplementModalOpen(false)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleImplementCutover} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Existing Inventory Disposition Strategy
                  <select
                    value={cutoverDisposition}
                    onChange={(e) => setCutoverDisposition(e.target.value)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="USE_EXISTING_FIRST">USE EXISTING INVENTORY FIRST (Phase-In)</option>
                    <option value="SCRAP_IMMEDIATELY">SCRAP OLD INVENTORY IMMEDIATELY (Hard Cutover)</option>
                    <option value="REWORK_ON_HAND">REWORK ON-HAND STOCK TO NEW SPEC</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Cutover Implementation Notes
                  <textarea
                    rows={3}
                    value={cutoverNotes}
                    onChange={(e) => setCutoverNotes(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsImplementModalOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? 'Cutting over…' : 'Execute Cutover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
