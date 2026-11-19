import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileDiff,
  FileText,
  Filter,
  Flame,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { Status } from '../../components/ui/Status';
import type { ItemSummary } from '../../types/inventory';
import type {
  EngineeringChangeOrder,
  EcoDetail,
  EcoSignOff,
  EcoMetrics,
  DepartmentType,
  ChangeSeverity,
  EcoStatus,
  BomRedlineComparison,
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

type EcoTab = 'ecos' | 'redline' | 'signoffs';

export function EngineeringChangePanel({ items, role, notify }: EngineeringChangePanelProps) {
  const [activeTab, setActiveTab] = useState<EcoTab>('ecos');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Core domain data
  const [ecos, setEcos] = useState<EngineeringChangeOrder[]>([]);
  const [metrics, setMetrics] = useState<EcoMetrics | null>(null);
  const [selectedEcoId, setSelectedEcoId] = useState<string | null>(null);
  const [selectedEcoDetail, setSelectedEcoDetail] = useState<EcoDetail | null>(null);
  const [redlineComparison, setRedlineComparison] = useState<BomRedlineComparison | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openEcoDrawer = (ecoId: string) => {
    selectEco(ecoId);
    setIsDrawerOpen(true);
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

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

  // Select an ECO to load detail and redline diff
  const selectEco = async (ecoId: string) => {
    setSelectedEcoId(ecoId);
    try {
      const [detailRes, diffRes] = await Promise.all([
        apiFetch(`${API}/engineering/ecos/${ecoId}`),
        apiFetch(`${API}/engineering/ecos/${ecoId}/redline-diff`)
      ]);

      if (detailRes.ok) {
        setSelectedEcoDetail(await detailRes.json());
      }
      if (diffRes.ok) {
        setRedlineComparison(await diffRes.json());
      }
    } catch (err) {
      console.error('Failed to load ECO details/diff:', err);
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
      const matchesSeverity = severityFilter === 'ALL' || e.changeSeverity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [ecos, searchQuery, statusFilter, severityFilter]);

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

      const res = await apiFetch(`${API}/engineering/ecos/${selectedEcoId}/sign-offs`, {
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

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'ecos' ? 'active' : ''}`}
            onClick={() => setActiveTab('ecos')}
          >
            <FileText size={13} />
            <span>Change Orders Register</span>
            <span className="sales-subnav-badge">{ecos.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'redline' ? 'active' : ''}`}
            onClick={() => setActiveTab('redline')}
          >
            <FileDiff size={13} />
            <span>BOM Redline Diff Studio</span>
            {selectedEcoDetail && (
              <span className="sales-subnav-badge">{selectedEcoDetail.ecoNumber}</span>
            )}
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'signoffs' ? 'active' : ''}`}
            onClick={() => setActiveTab('signoffs')}
          >
            <CheckSquare size={13} />
            <span>Department Sign-Off Matrix</span>
          </button>
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

      {/* 3. TAB 1: CHANGE ORDERS REGISTER */}
      {activeTab === 'ecos' && (
        selectedEcoDetail ? (
          /* =========================================================================
             AUTHENTIC LINEAR ISSUE DETAIL VIEW (MOBBIN CURATED)
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
                  <span>Engineering Change Orders</span>
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
                  >
                    <UserCheck size={12} />
                    <span>Sign-Off on ECO</span>
                  </button>
                )}

                {selectedEcoDetail.status === 'APPROVED' && (
                  <button
                    type="button"
                    className="sales-action-btn primary"
                    onClick={() => setIsImplementModalOpen(true)}
                  >
                    <Zap size={12} />
                    <span>Execute Production Cutover</span>
                  </button>
                )}

                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setActiveTab('redline')}
                >
                  <FileDiff size={12} />
                  <span>Open Redline Studio</span>
                </button>
              </div>
            </div>

            {/* 2-Column Linear Layout */}
            <div className="linear-detail-grid">
              {/* Left Column: Title, Narrative, Redline Diff, Sign-offs */}
              <div className="linear-detail-content">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="sales-ref-badge">{selectedEcoDetail.ecoNumber}</span>
                    <Status label={selectedEcoDetail.status} />
                    <span className={selectedEcoDetail.changeSeverity === 'CRITICAL' ? 'sales-sub-warning' : 'sales-warehouse-pill'}>
                      {selectedEcoDetail.changeSeverity} Severity
                    </span>
                  </div>
                  <h1 className="linear-detail-h1">{selectedEcoDetail.title}</h1>
                </div>

                {/* Justification & Narrative Card */}
                <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Engineering Justification & Problem Description
                  </div>
                  <p className="linear-detail-desc">{selectedEcoDetail.reason}</p>
                </div>

                {/* BOM Redline Delta Lines (Mobbin media_1.webp Sub-issues Style) */}
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GitBranch size={13} style={{ color: 'var(--sp-brand)' }} />
                      <span>BOM Component Redline Changes ({selectedEcoDetail.diffLines?.length || 0} Lines)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      Revision {selectedEcoDetail.baseRevision} → {selectedEcoDetail.targetRevision}
                    </span>
                  </div>
                  {(!selectedEcoDetail.diffLines || selectedEcoDetail.diffLines.length === 0) ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                      No bill of materials modifications specified.
                    </div>
                  ) : (
                    selectedEcoDetail.diffLines.map((line) => (
                      <div key={line.id} className="linear-subline-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={
                              line.changeType === 'ADD'
                                ? 'sales-sub-highlight'
                                : line.changeType === 'REMOVE'
                                ? 'sales-sub-warning'
                                : 'sales-warehouse-pill'
                            }
                            style={{ fontSize: '10px', padding: '1px 6px' }}
                          >
                            {line.changeType}
                          </span>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                              {line.componentName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              <span className="sales-ref-badge" style={{ fontSize: '10.5px', marginRight: '4px' }}>{line.componentSku}</span>
                              {line.notes ? `· ${line.notes}` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                          <span style={{ color: line.changeType === 'REMOVE' ? 'var(--sp-danger)' : 'var(--sp-text-muted)', textDecoration: line.changeType === 'REMOVE' ? 'line-through' : undefined }}>
                            {line.oldQuantity} {line.componentUnit}
                          </span>
                          {' → '}
                          <span style={{ fontWeight: 500, color: line.changeType === 'ADD' ? 'var(--sp-success)' : 'var(--sp-text)' }}>
                            {line.newQuantity} {line.componentUnit}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Department Sign-Off Matrix (Linear Activity Style) */}
                <div className="linear-sublines-card">
                  <div className="linear-sublines-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={13} style={{ color: 'var(--sp-brand)' }} />
                      <span>Departmental Sign-Off Ledger ({selectedEcoDetail.signOffs?.filter(s => s.status === 'APPROVED').length || 0}/{selectedEcoDetail.signOffs?.length || 0} Completed)</span>
                    </div>
                  </div>
                  {(!selectedEcoDetail.signOffs || selectedEcoDetail.signOffs.length === 0) ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                      No sign-offs recorded.
                    </div>
                  ) : (
                    selectedEcoDetail.signOffs.map((s) => (
                      <div key={s.id} className="linear-subline-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 500, fontSize: '12.5px', minWidth: '110px', textTransform: 'capitalize' }}>
                            {s.department.toLowerCase()}
                          </span>
                          <Status label={s.status} />
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                            {s.approverName ? `by ${s.approverName}` : 'Awaiting reviewer assignment'}
                            {s.comments ? ` · "${s.comments}"` : ''}
                          </span>
                        </div>
                        {s.approvedAt && (
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(s.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Linear Properties Sidebar */}
              <div className="linear-properties-sidebar">
                <div className="linear-properties-card">
                  <div className="linear-properties-title">Properties</div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Status</span>
                    <Status label={selectedEcoDetail.status} />
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Severity</span>
                    <span className={selectedEcoDetail.changeSeverity === 'CRITICAL' ? 'sales-sub-warning' : 'sales-warehouse-pill'}>
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
                    <span className="linear-property-value" style={{ fontWeight: 500, color: 'var(--sp-warning)' }}>
                      {new Date(selectedEcoDetail.effectiveCutoverDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Created By</span>
                    <span className="linear-property-value">{selectedEcoDetail.createdByName}</span>
                  </div>

                  <div className="linear-property-row">
                    <span className="linear-property-label">Created Date</span>
                    <span className="linear-property-value">
                      {new Date(selectedEcoDetail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {selectedEcoDetail.implementedAt && (
                    <div className="linear-property-row">
                      <span className="linear-property-label">Implemented</span>
                      <span className="linear-property-value" style={{ color: 'var(--sp-success)' }}>
                        {new Date(selectedEcoDetail.implementedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                placeholder="Filter by ECO #, title, finished item SKU, or reason…"
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

          {/* High-Density Table (Zero Horizontal Scroll) */}
          <div className="sales-table-card">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>ECO Number</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th>Change Title & Revision</th>
                  <th>Target Product & Reason</th>
                  <th style={{ width: '140px' }}>Sign-Offs & Cutover</th>
                  <th style={{ textAlign: 'right', width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEcos.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                      No engineering change orders found.
                    </td>
                  </tr>
                ) : (
                  filteredEcos.map((eco) => {
                    const isSelected = eco.id === selectedEcoId;
                    const formattedCutover = new Date(eco.effectiveCutoverDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    return (
                      <tr
                        key={eco.id}
                        className="sales-row"
                        onClick={() => selectEco(eco.id)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--sp-brand-soft)' : undefined
                        }}
                      >
                        <td>
                          <button
                            type="button"
                            className="sales-ref-badge interactive"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectEco(eco.id);
                            }}
                            title="Click to view full Linear change order details"
                          >
                            {eco.ecoNumber}
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <span
                              className={eco.changeSeverity === 'CRITICAL' ? 'sales-sub-warning' : 'sales-warehouse-pill'}
                            >
                              {eco.changeSeverity}
                            </span>
                          </div>
                        </td>

                        <td>
                          <Status label={eco.status} />
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{eco.title}</div>
                          <div className="sales-sub-ref">
                            {eco.finishedSku} · {eco.baseRevision} → <strong>{eco.targetRevision}</strong>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{eco.finishedItemName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                            {eco.reason}
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              eco.signOffsCompleted === eco.totalSignOffs
                                ? 'sales-sub-highlight'
                                : 'sales-sub-warning'
                            }
                          >
                            {eco.signOffsCompleted}/{eco.totalSignOffs} Signed
                          </span>
                          <div className="sales-date-cell" style={{ marginTop: '2px' }}>
                            {formattedCutover}
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectEco(eco.id);
                            }}
                          >
                            <span>Inspect</span>
                            <ChevronRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {/* 4. TAB 2: VISUAL BOM REDLINE DIFF STUDIO */}
      {activeTab === 'redline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {redlineComparison ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Diff Header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--sp-border)',
                  background: 'var(--sp-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="sales-ref-badge">{redlineComparison.ecoNumber}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)' }}>
                      {redlineComparison.finishedItemName} ({redlineComparison.finishedSku})
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    Baseline Revision: <strong>{redlineComparison.baseRevision}</strong> → Proposed Target: <strong>{redlineComparison.targetRevision}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="sales-sub-highlight">+{redlineComparison.addedCount} Added</span>
                  <span className="sales-sub-warning">~{redlineComparison.modifiedCount} Modified</span>
                  <span className="sales-sub-warning" style={{ color: 'var(--sp-danger)' }}>-{redlineComparison.removedCount} Removed</span>

                  {selectedEcoDetail?.status === 'APPROVED' && (
                    <button
                      type="button"
                      className="sales-action-btn primary"
                      onClick={() => setIsImplementModalOpen(true)}
                    >
                      <Zap size={12} />
                      <span>Implement Cutover</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
                {/* Left Column: Baseline BOM */}
                <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--sp-border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sp-text-muted)' }}>
                      Current Baseline ({redlineComparison.baseRevision})
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {redlineComparison.baselineLines.length} components
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {redlineComparison.baselineLines.map((line, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--sp-border-subtle)',
                          background: 'var(--sp-surface-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--sp-text)' }}>{line.name}</div>
                          <div className="sales-sub-ref">{line.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {line.quantity} {line.unit}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--sp-text-muted)' }}>Scrap: {line.scrapPercent}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Proposed Engineering Revision */}
                <div className="sales-table-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--sp-border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: 'var(--sp-text)' }}>
                      Proposed Redline ({redlineComparison.targetRevision})
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      {redlineComparison.proposedLines.length} components
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {redlineComparison.proposedLines.map((line, idx) => {
                      const isAdded = line.changeStatus === 'ADDED';
                      const isModified = line.changeStatus === 'MODIFIED';
                      const isRemoved = line.changeStatus === 'REMOVED';

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--sp-border-subtle)',
                            background: isAdded
                              ? 'var(--sp-brand-soft)'
                              : isModified
                              ? 'rgba(245, 158, 11, 0.08)'
                              : isRemoved
                              ? 'rgba(239, 68, 68, 0.08)'
                              : 'var(--sp-surface-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 500, textDecoration: isRemoved ? 'line-through' : 'none', color: 'var(--sp-text)' }}>
                                {line.name}
                              </span>
                              {isAdded && <span className="sales-sub-highlight">NEW</span>}
                              {isModified && <span className="sales-sub-warning">MODIFIED</span>}
                              {isRemoved && <span className="sales-sub-warning" style={{ color: 'var(--sp-danger)' }}>DELETED</span>}
                            </div>
                            <div className="sales-sub-ref">{line.sku}</div>
                            {line.changeNotes && (
                              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                “{line.changeNotes}”
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isModified ? (
                              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                                <span style={{ textDecoration: 'line-through', color: 'var(--sp-text-muted)', marginRight: '4px' }}>
                                  {line.previousQuantity}
                                </span>
                                → {line.quantity} {line.unit}
                              </div>
                            ) : (
                              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                                {line.quantity} {line.unit}
                              </span>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--sp-text-muted)' }}>Scrap: {line.scrapPercent}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sp-text-muted)' }}>
              Select an ECO from the register to explore its visual BOM redline diff.
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: DEPARTMENT SIGN-OFF MATRIX */}
      {activeTab === 'signoffs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedEcoDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--sp-border)',
                  background: 'var(--sp-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    Cross-Department Stage-Gate Approvals ({selectedEcoDetail.ecoNumber})
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Engineering change governance requires formal digital sign-off from all 4 disciplines prior to cutover.
                  </div>
                </div>

                {selectedEcoDetail.status === 'UNDER_REVIEW' && (
                  <button
                    type="button"
                    className="sales-action-btn primary"
                    onClick={() => setIsSignOffModalOpen(true)}
                  >
                    <UserCheck size={12} />
                    <span>Submit Sign-Off Review</span>
                  </button>
                )}
              </div>

              {/* 4 Department Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {selectedEcoDetail.signOffs.map((sign) => {
                  const isApproved = sign.status === 'APPROVED';

                  return (
                    <div key={sign.id} className="sales-metric-card" style={{ gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {sign.department}
                        </span>
                        <Status label={sign.status} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--sp-text-muted)' }}>Role: </span>
                          <strong>{sign.signOffRole || getDeptRoleDefault(sign.department)}</strong>
                        </div>
                        {isApproved && (
                          <>
                            <div>
                              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--sp-text-muted)' }}>Approver: </span>
                              <span>{sign.approverName || 'Authorized Engineer'}</span>
                            </div>
                            {sign.approvedAt && (
                              <div className="sales-date-cell">
                                Signed: {new Date(sign.approvedAt).toLocaleDateString()}
                              </div>
                            )}
                            {sign.comments && (
                              <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--sp-text-muted)' }}>
                                “{sign.comments}”
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sp-text-muted)' }}>
              Select an ECO to view its departmental sign-off matrix.
            </div>
          )}
        </div>
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
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Departmental Sign-Off Review</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Cast a digital stage-gate vote for {selectedEcoDetail?.ecoNumber}.
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
                  Reviewing Department
                  <select
                    value={signDepartment}
                    onChange={(e) => setSignDepartment(e.target.value as DepartmentType)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="ENGINEERING">ENGINEERING (Design Authority)</option>
                    <option value="MANUFACTURING">MANUFACTURING (Plant Tooling)</option>
                    <option value="QUALITY">QUALITY (ISO-9001 Compliance)</option>
                    <option value="FINANCE">FINANCE (BOM Standard Cost)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Stage-Gate Decision
                  <select
                    value={signStatus}
                    onChange={(e) => setSignStatus(e.target.value as 'APPROVED' | 'REJECTED')}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="APPROVED">APPROVE ECO (Proceed to Cutover)</option>
                    <option value="REJECTED">REJECT ECO (Send Back to Engineering)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Review Comments / Engineering Feedback
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
