import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  DollarSign,
  FileText,
  Filter,
  Kanban,
  LayoutList,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  User,
  UserCheck,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import type { ItemSummary } from '../../types/inventory';
import type { LeadConversionResult, LeadRecord, TenantBranchSummary, LeadActivity } from '../../types/crm';

function formDateTimeToIso(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value ? new Date(value).toISOString() : null;
}

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null || isNaN(Number(val))) return '₹ 0';
  return `₹ ${Number(val).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

interface StageMeta {
  id: string;
  label: string;
  color: string;
  desc: string;
}

const STAGES: StageMeta[] = [
  { id: 'NEW', label: 'New', color: '#38bdf8', desc: 'Newly captured prospect' },
  { id: 'QUALIFIED', label: 'Qualified', color: '#f59e0b', desc: 'Budget & requirements verified' },
  { id: 'PROPOSAL', label: 'Proposal', color: '#8b5cf6', desc: 'Commercial quotation sent' },
  { id: 'WON', label: 'Won', color: '#10b981', desc: 'Converted to customer' },
  { id: 'LOST', label: 'Lost', color: '#64748b', desc: 'Disqualified or closed' }
];

interface LeadPanelProps {
  items: ItemSummary[];
  notify: (message: string) => void;
  onConverted: () => Promise<void>;
}

export function LeadPanel({ items, notify, onConverted }: LeadPanelProps) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [branches, setBranches] = useState<TenantBranchSummary[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View & Filter states
  const [view, setView] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');

  // Form & Modals state
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState('NEW');
  const [expandedActivityLeadId, setExpandedActivityLeadId] = useState<string | null>(null);
  const [activeInlineActivityLeadId, setActiveInlineActivityLeadId] = useState<string | null>(null);

  // Convert Lead Modal state
  const [convertModalLead, setConvertModalLead] = useState<LeadRecord | null>(null);
  const [convertWithQuote, setConvertWithQuote] = useState(false);
  const [convertItemId, setConvertItemId] = useState('');
  const [convertQuantity, setConvertQuantity] = useState(1);
  const [convertUnitPrice, setConvertUnitPrice] = useState(0);
  const [convertQuoteNotes, setConvertQuoteNotes] = useState('');

  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/leads`);
    if (!response.ok) throw new Error('Could not load leads');
    setLeads(await response.json());
  };

  useEffect(() => {
    load()
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));

    apiFetch(`${API}/tenant/branches`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: TenantBranchSummary[]) => {
        setBranches(rows);
        setBranchId(rows.find((branch) => branch.defaultBranch)?.id || rows[0]?.id || '');
      })
      .catch(() => setBranches([]));
  }, []);

  const send = async <TResponse,>(
    path: string,
    method: 'POST' | 'PATCH' = 'POST',
    payload?: unknown
  ): Promise<TResponse | null> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}${path}`, {
        method,
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'CRM action failed');
      await load();
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
    if (!form.get('email') && !form.get('phone')) {
      notify('Enter an email address or phone number');
      return;
    }
    const saved = await send<LeadRecord>('/leads', 'POST', {
      name: form.get('name'),
      company: form.get('company') || null,
      email: form.get('email') || null,
      phone: form.get('phone') || null,
      source: form.get('source') || null,
      expectedValue: form.get('expectedValue') ? Number(form.get('expectedValue')) : null,
      nextActivityTitle: form.get('nextActivityTitle') || null,
      nextActivityAt: formDateTimeToIso(form, 'nextActivityAt'),
      branchId: form.get('branchId') || null
    });
    if (saved) {
      if (createInitialStage !== 'NEW') {
        await send<LeadRecord>(`/leads/${saved.id}/stage`, 'PATCH', { stage: createInitialStage });
      }
      formElement.reset();
      setShowCreatePanel(false);
      notify(`Lead prospect '${saved.name}' created`);
    }
  };

  const addActivity = async (event: FormEvent<HTMLFormElement>, lead: LeadRecord): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await send<LeadRecord>(`/leads/${lead.id}/activities`, 'POST', {
      activityType: form.get('activityType'),
      body: form.get('body'),
      dueAt: formDateTimeToIso(form, 'dueAt')
    });
    if (saved) {
      formElement.reset();
      setActiveInlineActivityLeadId(null);
      notify('Activity recorded on lead');
    }
  };

  const handleConvertSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!convertModalLead) return;

    const quoteLines =
      convertWithQuote && convertItemId
        ? [{ itemId: convertItemId, quantity: convertQuantity, unitPrice: convertUnitPrice }]
        : [];

    const result = await send<LeadConversionResult>(`/leads/${convertModalLead.id}/convert`, 'POST', {
      quoteLines,
      quoteNotes: convertWithQuote ? convertQuoteNotes || null : null
    });

    if (result) {
      notify(
        result.quoteNumber
          ? `Lead converted · ${result.customerName} · ${result.quoteNumber} created`
          : `Lead converted · ${result.customerName}`
      );
      setConvertModalLead(null);
      setConvertWithQuote(false);
      setConvertItemId('');
      await onConverted();
    }
  };

  const stage = async (lead: LeadRecord, value: string): Promise<void> => {
    const saved = await send<LeadRecord>(`/leads/${lead.id}/stage`, 'PATCH', { stage: value });
    if (saved) notify(`Stage updated to ${value}`);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const totalCount = leads.length;
    const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
    const openPipelineValue = openLeads.reduce((acc, l) => acc + (Number(l.expectedValue) || 0), 0);
    const proposalLeads = leads.filter((l) => l.stage === 'PROPOSAL');
    const proposalValue = proposalLeads.reduce((acc, l) => acc + (Number(l.expectedValue) || 0), 0);
    const wonLeads = leads.filter((l) => l.stage === 'WON' || !!l.convertedCustomerId);
    const wonValue = wonLeads.reduce((acc, l) => acc + (Number(l.expectedValue) || 0), 0);
    const overdueCount = openLeads.filter((l) => isOverdue(l.nextActivityAt)).length;

    return {
      totalCount,
      openCount: openLeads.length,
      openPipelineValue,
      proposalCount: proposalLeads.length,
      proposalValue,
      wonCount: wonLeads.length,
      wonValue,
      overdueCount
    };
  }, [leads]);

  // Stage counts map
  const stageCounts = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {
      NEW: { count: 0, value: 0 },
      QUALIFIED: { count: 0, value: 0 },
      PROPOSAL: { count: 0, value: 0 },
      WON: { count: 0, value: 0 },
      LOST: { count: 0, value: 0 }
    };
    leads.forEach((l) => {
      const s = l.stage in counts ? l.stage : 'NEW';
      counts[s].count++;
      counts[s].value += Number(l.expectedValue) || 0;
    });
    return counts;
  }, [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return leads.filter((lead) => {
      if (selectedBranchFilter !== 'ALL' && lead.branchId !== selectedBranchFilter) return false;
      if (selectedStageFilter !== 'ALL' && lead.stage !== selectedStageFilter) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)) ||
        (lead.source && lead.source.toLowerCase().includes(q)) ||
        (lead.nextActivityTitle && lead.nextActivityTitle.toLowerCase().includes(q))
      );
    });
  }, [leads, searchQuery, selectedBranchFilter, selectedStageFilter]);

  // Helper for activity type icon
  const renderActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL':
        return <PhoneCall size={12} color="#3b82f6" />;
      case 'EMAIL':
        return <Mail size={12} color="#8b5cf6" />;
      case 'MEETING':
        return <UserCheck size={12} color="#10b981" />;
      case 'TASK':
        return <CheckSquare size={12} color="#f59e0b" />;
      default:
        return <FileText size={12} color="#64748b" />;
    }
  };

  return (
    <div className="lead-layout">
      {/* 1. Linear Metric Strip */}
      <div className="leads-metrics-strip">
        <div className="lead-metric-card">
          <div className="lead-metric-head">
            <span className="lead-metric-title">Active Pipeline</span>
            <div className="lead-metric-icon"><TrendingUp size={14} /></div>
          </div>
          <div className="lead-metric-value">{formatCurrency(metrics.openPipelineValue)}</div>
          <div className="lead-metric-sub">{metrics.openCount} open deals across stages</div>
        </div>

        <div className="lead-metric-card">
          <div className="lead-metric-head">
            <span className="lead-metric-title">Proposals Active</span>
            <div className="lead-metric-icon"><FileText size={14} /></div>
          </div>
          <div className="lead-metric-value">{formatCurrency(metrics.proposalValue)}</div>
          <div className="lead-metric-sub">{metrics.proposalCount} high-intent commercial deals</div>
        </div>

        <div className="lead-metric-card">
          <div className="lead-metric-head">
            <span className="lead-metric-title">Won & Converted</span>
            <div className="lead-metric-icon"><CheckCircle2 size={14} /></div>
          </div>
          <div className="lead-metric-value">{formatCurrency(metrics.wonValue)}</div>
          <div className="lead-metric-sub">{metrics.wonCount} accounts won to date</div>
        </div>

        <div className="lead-metric-card">
          <div className="lead-metric-head">
            <span className="lead-metric-title">Activities Due</span>
            <div className="lead-metric-icon"><Clock size={14} /></div>
          </div>
          <div className="lead-metric-value">
            {metrics.overdueCount > 0 ? (
              <span style={{ color: 'var(--sp-error, #ef4444)' }}>{metrics.overdueCount} Overdue</span>
            ) : (
              'On Track'
            )}
          </div>
          <div className="lead-metric-sub">
            {metrics.openCount} prospects in active sequence
          </div>
        </div>
      </div>

      {/* 2. Linear View Toolbar & Search */}
      <div className="leads-toolbar">
        <div className="leads-toolbar-top">
          {/* Segmented View Switcher */}
          <div className="leads-view-toggle">
            <button
              type="button"
              className={`leads-view-btn ${view === 'board' ? 'active' : ''}`}
              onClick={() => setView('board')}
            >
              <Kanban size={13} />
              Board
            </button>
            <button
              type="button"
              className={`leads-view-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              <LayoutList size={13} />
              List
            </button>
          </div>

          {/* Quick Search */}
          <div className="leads-search-box">
            <Search size={14} />
            <input
              type="text"
              className="leads-search-input"
              placeholder="Filter leads by name, company, contact or source…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action buttons & Branch */}
          <div className="leads-toolbar-actions">
            {branches.length > 1 && (
              <select
                aria-label="Filter by branch"
                className="leads-branch-select"
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
              >
                <option value="ALL">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setShowCreatePanel(!showCreatePanel);
                setCreateInitialStage('NEW');
              }}
            >
              <Plus size={14} />
              {showCreatePanel ? 'Close form' : 'New lead'}
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="leads-filter-pills">
          <button
            type="button"
            className={`leads-filter-pill ${selectedStageFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedStageFilter('ALL')}
          >
            All leads <span className="leads-pill-count">{leads.length}</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`leads-filter-pill ${selectedStageFilter === s.id ? 'active' : ''}`}
              onClick={() => setSelectedStageFilter(selectedStageFilter === s.id ? 'ALL' : s.id)}
            >
              <span className="leads-stage-dot" style={{ backgroundColor: s.color }} />
              {s.label} <span className="leads-pill-count">{stageCounts[s.id]?.count || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Collapsible Add Lead Drawer Panel */}
      {showCreatePanel && (
        <section className="leads-create-panel">
          <div className="leads-create-panel-header">
            <div>
              <h3>Add New Prospect</h3>
              <p>Capture prospect details, commercial value, and schedule immediate next action.</p>
            </div>
            <button
              type="button"
              className="leads-modal-close-btn"
              onClick={() => setShowCreatePanel(false)}
            >
              <X size={16} />
            </button>
          </div>

          <form className="lead-create-form" onSubmit={create}>
            <label>
              Contact name *
              <input name="name" required maxLength={180} placeholder="e.g. Ramesh Kulkarni" autoFocus />
            </label>
            <label>
              Company / Enterprise
              <input name="company" maxLength={180} placeholder="e.g. Bharat Forge Precision" />
            </label>
            <label>
              Work email
              <input name="email" type="email" maxLength={254} placeholder="prospect@company.com" />
            </label>
            <label>
              Phone number
              <input name="phone" maxLength={40} placeholder="+91 98200 00000" />
            </label>
            <label>
              Acquisition source
              <input name="source" maxLength={80} placeholder="Referral, Inbound, Trade Show…" />
            </label>
            {branches.length > 0 && (
              <label>
                Assigned branch
                <select name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Expected deal value (₹)
              <input name="expectedValue" type="number" min="0" step="0.01" placeholder="500000" />
            </label>
            <label>
              Immediate next action
              <input name="nextActivityTitle" maxLength={180} placeholder="Product demo, quotation…" />
            </label>
            <label>
              Next action due date
              <input name="nextActivityAt" type="datetime-local" />
            </label>

            <div className="lead-create-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowCreatePanel(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create prospect'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 4. Main Body: Kanban Board vs. List Register */}
      {loading ? (
        <div className="panel production-empty" style={{ padding: '48px', textAlign: 'center' }}>
          Loading CRM pipeline…
        </div>
      ) : leads.length === 0 ? (
        <div className="panel production-empty" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Sparkles size={24} style={{ color: 'var(--sp-brand, #8b5cf6)', marginBottom: '8px' }} />
          <h3>No prospects in pipeline</h3>
          <p>Click "New lead" above to capture prospects and start moving deals forward.</p>
        </div>
      ) : view === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="leads-board-container">
          {STAGES.filter((s) => selectedStageFilter === 'ALL' || selectedStageFilter === s.id).map((stageItem) => {
            const columnLeads = filteredLeads.filter((l) => l.stage === stageItem.id);
            const colTotalValue = columnLeads.reduce((sum, l) => sum + (Number(l.expectedValue) || 0), 0);

            return (
              <div key={stageItem.id} className="leads-stage-col">
                {/* Column Header */}
                <div className="leads-col-header">
                  <div className="leads-col-title-wrap">
                    <span className="leads-stage-dot" style={{ backgroundColor: stageItem.color }} />
                    <span className="leads-col-title">{stageItem.label}</span>
                    <span className="leads-col-count">{columnLeads.length}</span>
                  </div>
                  <div className="leads-col-meta">
                    <span className="leads-col-value">{formatCurrency(colTotalValue)}</span>
                    <button
                      type="button"
                      className="leads-col-add-btn"
                      title={`Add lead in ${stageItem.label}`}
                      onClick={() => {
                        setCreateInitialStage(stageItem.id);
                        setShowCreatePanel(true);
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Column Cards */}
                <div className="leads-col-cards">
                  {columnLeads.length === 0 ? (
                    <div className="leads-col-empty">
                      <span>No leads in {stageItem.label}</span>
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const hasNext = !!lead.nextActivityTitle;
                      const nextOverdue = hasNext && isOverdue(lead.nextActivityAt);
                      const isActivitiesExpanded = expandedActivityLeadId === lead.id;
                      const isInlineActivityActive = activeInlineActivityLeadId === lead.id;
                      const branchName = branches.find((b) => b.id === lead.branchId)?.name;

                      return (
                        <article key={lead.id} className="lead-kanban-card">
                          {/* Card Top: Company / Name & Expected Value */}
                          <div className="lead-card-top">
                            <div className="lead-card-identity">
                              <h4 className="lead-card-title">{lead.company || lead.name}</h4>
                              {lead.company && (
                                <span className="lead-card-contact-name">
                                  <User size={11} /> {lead.name}
                                </span>
                              )}
                            </div>
                            {lead.expectedValue != null && (
                              <div className="lead-card-value-badge">
                                {formatCurrency(lead.expectedValue)}
                              </div>
                            )}
                          </div>

                          {/* Contact Details */}
                          <div className="lead-card-comms">
                            {lead.email && (
                              <a href={`mailto:${lead.email}`} className="lead-comm-item" title={lead.email}>
                                <Mail size={11} /> {lead.email}
                              </a>
                            )}
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`} className="lead-comm-item" title={lead.phone}>
                                <Phone size={11} /> {lead.phone}
                              </a>
                            )}
                          </div>

                          {/* Badges: Source & Branch */}
                          <div className="lead-card-chips">
                            {lead.source && <span className="lead-chip">{lead.source}</span>}
                            {branchName && <span className="lead-chip lead-chip-branch">{branchName}</span>}
                          </div>

                          {/* Next Action Box */}
                          {hasNext && (
                            <div className="lead-card-next-action">
                              <div className="lead-card-next-action-header">
                                <Clock size={11} /> Next action
                              </div>
                              <div className="lead-card-next-action-title">{lead.nextActivityTitle}</div>
                              {lead.nextActivityAt && (
                                <div className={`lead-card-next-action-due ${nextOverdue ? 'overdue' : ''}`}>
                                  {nextOverdue ? '⚠️ Overdue · ' : 'Due · '}
                                  {formatDate(lead.nextActivityAt)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Activities Summary & Toggle */}
                          <div className="lead-card-activity-summary">
                            <span>{lead.activities?.length || 0} activities recorded</span>
                            {lead.activities && lead.activities.length > 0 && (
                              <button
                                type="button"
                                className="lead-card-activity-toggle"
                                onClick={() =>
                                  setExpandedActivityLeadId(isActivitiesExpanded ? null : lead.id)
                                }
                              >
                                {isActivitiesExpanded ? 'Hide' : 'History'}
                                {isActivitiesExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                              </button>
                            )}
                          </div>

                          {/* Expanded Activity Stream */}
                          {isActivitiesExpanded && lead.activities && lead.activities.length > 0 && (
                            <div className="lead-activity-stream">
                              {lead.activities.map((act) => (
                                <div key={act.id} className="lead-activity-stream-item">
                                  <div
                                    className="lead-activity-stream-icon"
                                    style={{ background: 'var(--sp-surface-subtle)' }}
                                  >
                                    {renderActivityIcon(act.activityType)}
                                  </div>
                                  <div className="lead-activity-stream-body">
                                    <p>{act.body}</p>
                                    <time>{formatDate(act.createdAt)}</time>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Log Activity Box */}
                          {isInlineActivityActive && (
                            <form
                              className="lead-inline-activity-box"
                              onSubmit={(e) => addActivity(e, lead)}
                            >
                              <div className="lead-inline-activity-top">
                                <select name="activityType" defaultValue="CALL">
                                  <option value="CALL">Call</option>
                                  <option value="EMAIL">Email</option>
                                  <option value="MEETING">Meeting</option>
                                  <option value="TASK">Task</option>
                                  <option value="NOTE">Note</option>
                                </select>
                                <input
                                  name="dueAt"
                                  type="datetime-local"
                                  title="Due date (optional)"
                                />
                              </div>
                              <textarea
                                name="body"
                                required
                                maxLength={2000}
                                placeholder="Add notes, conversation recap, or action items…"
                                autoFocus
                              />
                              <div className="lead-inline-activity-bottom">
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                                  onClick={() => setActiveInlineActivityLeadId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="button button-primary"
                                  style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving…' : 'Save note'}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Card Controls: Stage Move, Log Activity, Convert */}
                          <div className="lead-card-controls">
                            <select
                              aria-label={`Stage for ${lead.name}`}
                              className="lead-stage-select"
                              value={lead.stage}
                              disabled={saving || !!lead.convertedCustomerId}
                              onChange={(e) => stage(lead, e.target.value)}
                            >
                              {STAGES.map((s) => (
                                <option
                                  key={s.id}
                                  value={s.id}
                                  disabled={s.id === 'WON' && !lead.convertedCustomerId}
                                >
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <div className="lead-card-actions">
                              {!lead.convertedCustomerId && (
                                <button
                                  type="button"
                                  className="lead-action-icon-btn"
                                  title="Log note, call or task"
                                  onClick={() =>
                                    setActiveInlineActivityLeadId(
                                      isInlineActivityActive ? null : lead.id
                                    )
                                  }
                                >
                                  <MessageSquare size={12} />
                                  Log
                                </button>
                              )}

                              {!lead.convertedCustomerId && lead.stage !== 'WON' && (
                                <button
                                  type="button"
                                  className="lead-action-icon-btn primary"
                                  title="Convert to Customer & Quote"
                                  onClick={() => {
                                    setConvertModalLead(lead);
                                    setConvertWithQuote(false);
                                    setConvertItemId(items[0]?.id || '');
                                    setConvertQuantity(1);
                                    setConvertUnitPrice(Number(items[0]?.unitPrice) || 0);
                                  }}
                                >
                                  <UserCheck size={12} />
                                  Convert
                                </button>
                              )}

                              {lead.convertedCustomerId && (
                                <span className="lead-converted-badge" title="Customer converted">
                                  <Check size={11} /> Won
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LINEAR LIST REGISTER VIEW */
        <div className="leads-list-container">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Prospect / Enterprise</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Contact</th>
                <th>Next Action</th>
                <th>Source</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const branchName = branches.find((b) => b.id === lead.branchId)?.name;
                const nextOverdue = lead.nextActivityAt && isOverdue(lead.nextActivityAt);

                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--sp-text)' }}>
                          {lead.company || lead.name}
                        </span>
                        {lead.company && (
                          <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                            {lead.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Stage for ${lead.name}`}
                        className="lead-stage-select"
                        value={lead.stage}
                        disabled={saving || !!lead.convertedCustomerId}
                        onChange={(e) => stage(lead, e.target.value)}
                      >
                        {STAGES.map((s) => (
                          <option
                            key={s.id}
                            value={s.id}
                            disabled={s.id === 'WON' && !lead.convertedCustomerId}
                          >
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="lead-card-value-badge" style={{ display: 'inline-block' }}>
                        {formatCurrency(lead.expectedValue)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11.5px' }}>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} style={{ color: 'var(--sp-text-muted)' }}>
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} style={{ color: 'var(--sp-text-subtle)' }}>
                            {lead.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      {lead.nextActivityTitle ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--sp-text)' }}>
                            {lead.nextActivityTitle}
                          </span>
                          {lead.nextActivityAt && (
                            <span style={{ color: nextOverdue ? 'var(--sp-error)' : 'var(--sp-text-muted)' }}>
                              {nextOverdue ? 'Overdue · ' : ''}
                              {formatDate(lead.nextActivityAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--sp-text-subtle)', fontSize: '11px' }}>None set</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {lead.source && <span className="lead-chip">{lead.source}</span>}
                        {branchName && <span className="lead-chip lead-chip-branch">{branchName}</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {!lead.convertedCustomerId && (
                          <button
                            type="button"
                            className="lead-action-icon-btn"
                            onClick={() => {
                              setActiveInlineActivityLeadId(lead.id);
                              setView('board');
                            }}
                          >
                            <MessageSquare size={12} />
                            Log
                          </button>
                        )}
                        {!lead.convertedCustomerId && lead.stage !== 'WON' && (
                          <button
                            type="button"
                            className="lead-action-icon-btn primary"
                            onClick={() => {
                              setConvertModalLead(lead);
                              setConvertWithQuote(false);
                              setConvertItemId(items[0]?.id || '');
                              setConvertQuantity(1);
                              setConvertUnitPrice(Number(items[0]?.unitPrice) || 0);
                            }}
                          >
                            <UserCheck size={12} />
                            Convert
                          </button>
                        )}
                        {lead.convertedCustomerId && (
                          <span className="lead-converted-badge">
                            <Check size={11} /> Won
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Convert to Customer & Sales Quote Linear Modal */}
      {convertModalLead && (
        <div className="leads-modal-overlay" onClick={() => setConvertModalLead(null)}>
          <div className="leads-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="leads-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={16} color="var(--sp-brand, #8b5cf6)" />
                <h3>Convert Prospect to Customer</h3>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setConvertModalLead(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit}>
              <div className="leads-modal-body">
                {/* Lead Prospect Summary */}
                <div className="leads-modal-lead-summary">
                  <b>{convertModalLead.name} {convertModalLead.company ? `(${convertModalLead.company})` : ''}</b>
                  <span>
                    {[convertModalLead.email, convertModalLead.phone, convertModalLead.source]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {convertModalLead.expectedValue != null && (
                    <span style={{ fontWeight: 600, color: 'var(--sp-success, #10b981)', marginTop: '2px' }}>
                      Pipeline value: {formatCurrency(convertModalLead.expectedValue)}
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                  This action will create a permanent Customer record in Spindl master data and advance
                  this lead to Won.
                </p>

                {/* Optional Sales Quote Section */}
                <div className="leads-quote-section">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--sp-text)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={convertWithQuote}
                      onChange={(e) => setConvertWithQuote(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--sp-brand, #8b5cf6)' }}
                    />
                    Generate initial Sales Quotation
                  </label>

                  {convertWithQuote && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                        Quotation Item
                        <select
                          className="leads-branch-select"
                          value={convertItemId}
                          onChange={(e) => {
                            const found = items.find((it) => it.id === e.target.value);
                            setConvertItemId(e.target.value);
                            if (found?.unitPrice != null) {
                              setConvertUnitPrice(Number(found.unitPrice));
                            }
                          }}
                        >
                          <option value="">Customer only (no quote item)</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.sku} · {item.name} {item.unitPrice ? `(₹ ${Number(item.unitPrice).toLocaleString('en-IN')})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      {convertItemId && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                            Quantity
                            <input
                              type="number"
                              min="1"
                              value={convertQuantity}
                              onChange={(e) => setConvertQuantity(Math.max(1, Number(e.target.value)))}
                              style={{ height: '32px', padding: '0 8px', border: '1px solid var(--sp-border)', borderRadius: '6px' }}
                            />
                          </label>

                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                            Unit Price (₹)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={convertUnitPrice}
                              onChange={(e) => setConvertUnitPrice(Number(e.target.value))}
                              style={{ height: '32px', padding: '0 8px', border: '1px solid var(--sp-border)', borderRadius: '6px' }}
                            />
                          </label>
                        </div>
                      )}

                      {convertItemId && (
                        <div
                          style={{
                            padding: '8px 10px',
                            background: 'var(--sp-surface-subtle)',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <span>Estimated Quote Subtotal:</span>
                          <span style={{ color: 'var(--sp-brand, #8b5cf6)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(convertQuantity * convertUnitPrice)}
                          </span>
                        </div>
                      )}

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                        Commercial Terms / Notes
                        <input
                          type="text"
                          maxLength={1000}
                          placeholder="Standard 30-day validity, freight extra…"
                          value={convertQuoteNotes}
                          onChange={(e) => setConvertQuoteNotes(e.target.value)}
                          style={{ height: '32px', padding: '0 8px', border: '1px solid var(--sp-border)', borderRadius: '6px' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="leads-modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setConvertModalLead(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Converting…' : convertWithQuote && convertItemId ? 'Convert & Issue Quote' : 'Convert to Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
