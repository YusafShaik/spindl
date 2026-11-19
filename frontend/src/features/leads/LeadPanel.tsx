import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  Filter,
  Flame,
  Kanban,
  LayoutList,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
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

  // View & Filter states (Default to High-Density List for Scalability)
  const [view, setView] = useState<'board' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');

  // High-Scale Triage, Multi-Select & Drawer States
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [presetFilter, setPresetFilter] = useState<'ALL' | 'OVERDUE' | 'HIGH_VALUE' | 'TODAY'>('ALL');
  const [sortField, setSortField] = useState<'name' | 'value' | 'nextAction' | 'stage'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  // Bulk Multi-Select Handlers
  const toggleSelectLead = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (currentPageLeadIds: string[]) => {
    setSelectedLeadIds((prev) => {
      const allSelected = currentPageLeadIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        currentPageLeadIds.forEach((id) => next.delete(id));
      } else {
        currentPageLeadIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkStageChange = async (targetStage: string): Promise<void> => {
    if (!targetStage || selectedLeadIds.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedLeadIds);
      for (const id of ids) {
        await apiFetch(`${API}/leads/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: targetStage })
        });
      }
      notify(`Updated ${ids.length} leads to stage ${targetStage}`);
      setSelectedLeadIds(new Set());
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const exportSelectedLeadsCsv = (): void => {
    const leadsToExport = leads.filter((l) => selectedLeadIds.has(l.id));
    if (leadsToExport.length === 0) return;
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Stage', 'Expected Value', 'Source', 'Next Action', 'Due Date'];
    const rows = leadsToExport.map((l) => [
      l.name,
      l.company || '',
      l.email || '',
      l.phone || '',
      l.stage,
      l.expectedValue != null ? String(l.expectedValue) : '',
      l.source || '',
      l.nextActivityTitle || '',
      l.nextActivityAt || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `spindl-leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify(`Exported ${leadsToExport.length} prospects as CSV`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notify(`Copied ${label} to clipboard`);
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

  // Filtered & Sorted Leads
  const processedLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = leads.filter((lead) => {
      if (selectedBranchFilter !== 'ALL' && lead.branchId !== selectedBranchFilter) return false;
      if (selectedStageFilter !== 'ALL' && lead.stage !== selectedStageFilter) return false;

      // Smart Presets
      if (presetFilter === 'OVERDUE') {
        if (!isOverdue(lead.nextActivityAt) || lead.stage === 'WON' || lead.stage === 'LOST') return false;
      } else if (presetFilter === 'HIGH_VALUE') {
        if ((Number(lead.expectedValue) || 0) < 500000) return false;
      } else if (presetFilter === 'TODAY') {
        if (!lead.nextActivityAt || isOverdue(lead.nextActivityAt) || lead.stage === 'WON' || lead.stage === 'LOST') return false;
      }

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

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'value') {
        cmp = (Number(a.expectedValue) || 0) - (Number(b.expectedValue) || 0);
      } else if (sortField === 'name') {
        cmp = (a.company || a.name).localeCompare(b.company || b.name);
      } else if (sortField === 'stage') {
        cmp = a.stage.localeCompare(b.stage);
      } else if (sortField === 'nextAction') {
        const timeA = a.nextActivityAt ? new Date(a.nextActivityAt).getTime() : Infinity;
        const timeB = b.nextActivityAt ? new Date(b.nextActivityAt).getTime() : Infinity;
        cmp = timeA - timeB;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [leads, searchQuery, selectedBranchFilter, selectedStageFilter, presetFilter, sortField, sortDir]);

  // Paginated Slice for High-Density List
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedLeads.slice(start, start + pageSize);
  }, [processedLeads, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processedLeads.length / pageSize));
  const inspectedLead = useMemo(() => leads.find((l) => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

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

        {/* Smart Triage Presets */}
        <div className="leads-smart-presets">
          <button
            type="button"
            className={`leads-preset-btn ${presetFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setPresetFilter('ALL');
              setCurrentPage(1);
            }}
          >
            All Prospects
            <span className="leads-preset-count">{leads.length}</span>
          </button>
          <button
            type="button"
            className={`leads-preset-btn urgent ${presetFilter === 'OVERDUE' ? 'active' : ''}`}
            onClick={() => {
              setPresetFilter('OVERDUE');
              setCurrentPage(1);
            }}
          >
            <Flame size={12} color={presetFilter === 'OVERDUE' ? 'var(--sp-danger)' : '#f97316'} />
            Needs Attention (Overdue)
            <span className="leads-preset-count">{metrics.overdueCount}</span>
          </button>
          <button
            type="button"
            className={`leads-preset-btn ${presetFilter === 'HIGH_VALUE' ? 'active' : ''}`}
            onClick={() => {
              setPresetFilter('HIGH_VALUE');
              setCurrentPage(1);
            }}
          >
            💎 High Value (≥ ₹5L)
            <span className="leads-preset-count">
              {leads.filter((l) => (Number(l.expectedValue) || 0) >= 500000).length}
            </span>
          </button>
          <button
            type="button"
            className={`leads-preset-btn ${presetFilter === 'TODAY' ? 'active' : ''}`}
            onClick={() => {
              setPresetFilter('TODAY');
              setCurrentPage(1);
            }}
          >
            <Clock size={12} />
            Next Action Due
            <span className="leads-preset-count">
              {leads.filter((l) => l.nextActivityAt && !isOverdue(l.nextActivityAt) && l.stage !== 'WON' && l.stage !== 'LOST').length}
            </span>
          </button>
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
        /* COMPACT HIGH-SCALE KANBAN BOARD VIEW */
        <div className="leads-board-container">
          {STAGES.filter((s) => selectedStageFilter === 'ALL' || selectedStageFilter === s.id).map((stageItem) => {
            const columnLeads = processedLeads.filter((l) => l.stage === stageItem.id);
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

                {/* Compact Scannable Column Cards */}
                <div className="leads-col-cards">
                  {columnLeads.length === 0 ? (
                    <div className="leads-col-empty">
                      <span>No leads in {stageItem.label}</span>
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const hasNext = !!lead.nextActivityTitle;
                      const nextOverdue = hasNext && isOverdue(lead.nextActivityAt);
                      const branchName = branches.find((b) => b.id === lead.branchId)?.name;

                      return (
                        <article
                          key={lead.id}
                          className="lead-compact-card"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <div className="lead-compact-top">
                            <h4 className="lead-compact-title" title={lead.company || lead.name}>
                              {lead.company || lead.name}
                            </h4>
                            {lead.expectedValue != null && (
                              <span className="lead-compact-value">
                                {formatCurrency(lead.expectedValue)}
                              </span>
                            )}
                          </div>
                          <div className="lead-compact-sub">
                            <span className="lead-compact-contact">
                              {lead.company ? lead.name : (lead.email || lead.phone || 'Direct')}
                            </span>
                            {branchName && <span className="lead-chip lead-chip-branch">{branchName}</span>}
                          </div>
                          <div className="lead-compact-footer">
                            {lead.convertedCustomerId ? (
                              <span
                                className="lead-action-pill"
                                style={{ background: 'var(--sp-success-soft, #d1fae5)', color: 'var(--sp-success, #10b981)' }}
                              >
                                ✓ Customer
                              </span>
                            ) : hasNext ? (
                              <span className={`lead-action-pill ${nextOverdue ? 'overdue' : 'scheduled'}`}>
                                <Clock size={10} />
                                {nextOverdue ? 'Overdue' : 'Scheduled'}
                              </span>
                            ) : (
                              <span className="lead-action-pill none">No next action</span>
                            )}
                            <span style={{ color: 'var(--sp-text-muted)' }}>
                              {lead.activities?.length || 0} notes
                            </span>
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
        /* HIGH-DENSITY LINEAR TRIAGE TABLE */
        <div className="leads-table-container">
          <table className="leads-triage-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      paginatedLeads.length > 0 &&
                      paginatedLeads.every((l) => selectedLeadIds.has(l.id))
                    }
                    onChange={() => toggleSelectAll(paginatedLeads.map((l) => l.id))}
                    aria-label="Select all on this page"
                    style={{ cursor: 'pointer', accentColor: 'var(--sp-brand, #8b5cf6)' }}
                  />
                </th>
                <th
                  className="sortable"
                  onClick={() => {
                    if (sortField === 'name') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortField('name');
                      setSortDir('asc');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Prospect / Enterprise
                    <ArrowUpDown size={11} color={sortField === 'name' ? 'var(--sp-brand)' : 'currentColor'} />
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => {
                    if (sortField === 'stage') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortField('stage');
                      setSortDir('asc');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Stage
                    <ArrowUpDown size={11} color={sortField === 'stage' ? 'var(--sp-brand)' : 'currentColor'} />
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => {
                    if (sortField === 'value') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortField('value');
                      setSortDir('desc');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Expected Value
                    <ArrowUpDown size={11} color={sortField === 'value' ? 'var(--sp-brand)' : 'currentColor'} />
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => {
                    if (sortField === 'nextAction') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortField('nextAction');
                      setSortDir('asc');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Next Scheduled Action
                    <ArrowUpDown size={11} color={sortField === 'nextAction' ? 'var(--sp-brand)' : 'currentColor'} />
                  </div>
                </th>
                <th>Contact</th>
                <th>Source & Branch</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--sp-text-muted)' }}>
                    No prospects match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const branchName = branches.find((b) => b.id === lead.branchId)?.name;
                  const hasNext = !!lead.nextActivityTitle;
                  const nextOverdue = hasNext && isOverdue(lead.nextActivityAt);
                  const isSelected = selectedLeadIds.has(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`lead-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectLead(lead.id, e)}
                          aria-label={`Select ${lead.name}`}
                          style={{ cursor: 'pointer', accentColor: 'var(--sp-brand, #8b5cf6)' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--sp-text)' }}>
                            {lead.company || lead.name}
                          </span>
                          {lead.company && (
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              <User size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {lead.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
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
                        <span className="lead-compact-value" style={{ fontSize: '12px' }}>
                          {formatCurrency(lead.expectedValue)}
                        </span>
                      </td>
                      <td>
                        {hasNext ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '11.5px' }}>
                              {lead.nextActivityTitle}
                            </span>
                            {lead.nextActivityAt && (
                              <span
                                className={`lead-action-pill ${nextOverdue ? 'overdue' : 'scheduled'}`}
                                style={{ alignSelf: 'flex-start' }}
                              >
                                <Clock size={10} />
                                {nextOverdue ? 'Overdue · ' : 'Due · '}
                                {formatDate(lead.nextActivityAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="lead-action-pill none">No action scheduled</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'var(--sp-text-muted)' }}
                            >
                              {lead.email}
                            </a>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'var(--sp-text-subtle)' }}
                            >
                              {lead.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {lead.source && <span className="lead-chip">{lead.source}</span>}
                          {branchName && <span className="lead-chip lead-chip-branch">{branchName}</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {!lead.convertedCustomerId && lead.stage !== 'WON' ? (
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
                          ) : (
                            <span className="lead-converted-badge">
                              <Check size={11} /> Won
                            </span>
                          )}
                          <button
                            type="button"
                            className="lead-action-icon-btn"
                            title="Inspect details"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* High-Scale Pagination Bar */}
          <div className="leads-pagination-bar">
            <div>
              Showing {processedLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, processedLeads.length)} of {processedLeads.length} prospects
              {selectedLeadIds.size > 0 && ` (${selectedLeadIds.size} selected)`}
            </div>
            <div className="leads-pagination-controls">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="leads-bulk-select"
                  style={{ background: 'var(--sp-surface)', color: 'var(--sp-text)', borderColor: 'var(--sp-border)' }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <button
                type="button"
                className="leads-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={13} />
                Prev
              </button>
              <span style={{ fontWeight: 600, color: 'var(--sp-text)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="leads-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedLeadIds.size > 0 && (
        <div className="leads-bulk-floating-bar">
          <span className="leads-bulk-count">{selectedLeadIds.size} prospects selected</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>Move stage:</span>
            <select
              aria-label="Bulk update stage"
              className="leads-bulk-select"
              defaultValue=""
              disabled={saving}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStageChange(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>Select target stage…</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="leads-bulk-btn"
            onClick={exportSelectedLeadsCsv}
            title="Export selected leads to CSV"
          >
            <Download size={13} />
            Export CSV
          </button>
          <button
            type="button"
            className="leads-bulk-clear-btn"
            onClick={() => setSelectedLeadIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Slide-Over Lead Inspector Drawer */}
      {inspectedLead && (
        <div className="leads-drawer-backdrop" onClick={() => setSelectedLeadId(null)}>
          <div className="leads-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="leads-drawer-header">
              <div className="leads-drawer-title">
                <h2 className="leads-drawer-h2">{inspectedLead.company || inspectedLead.name}</h2>
                {inspectedLead.company && (
                  <span className="leads-drawer-sub">
                    <User size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {inspectedLead.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {inspectedLead.expectedValue != null && (
                  <span className="lead-card-value-badge" style={{ fontSize: '12px', padding: '3px 8px' }}>
                    {formatCurrency(inspectedLead.expectedValue)}
                  </span>
                )}
                <button
                  type="button"
                  className="leads-modal-close-btn"
                  onClick={() => setSelectedLeadId(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Stage Stepper */}
            <div className="leads-drawer-stepper">
              {STAGES.map((s) => {
                const isCurrent = inspectedLead.stage === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`leads-stepper-btn ${isCurrent ? 'active' : ''}`}
                    disabled={saving || (s.id === 'WON' && !inspectedLead.convertedCustomerId)}
                    onClick={() => stage(inspectedLead, s.id)}
                    title={s.desc}
                  >
                    <span className="leads-stage-dot" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body */}
            <div className="leads-drawer-body">
              {/* Quick Action Bar */}
              <div className="leads-drawer-actions">
                {!inspectedLead.convertedCustomerId && inspectedLead.stage !== 'WON' ? (
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ height: '32px', fontSize: '12px' }}
                    onClick={() => {
                      setConvertModalLead(inspectedLead);
                      setConvertWithQuote(false);
                      setConvertItemId(items[0]?.id || '');
                      setConvertQuantity(1);
                      setConvertUnitPrice(Number(items[0]?.unitPrice) || 0);
                    }}
                  >
                    <UserCheck size={14} />
                    Convert to Customer & Quote
                  </button>
                ) : (
                  <span className="lead-converted-badge" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Check size={13} /> Converted Customer Record
                  </span>
                )}
              </div>

              {/* Prospect Dossier Card */}
              <div className="leads-dossier-card">
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Prospect Dossier
                </div>
                <div className="leads-dossier-grid">
                  <div className="leads-dossier-field">
                    <span className="label">Contact Name</span>
                    <span className="val">{inspectedLead.name}</span>
                  </div>
                  <div className="leads-dossier-field">
                    <span className="label">Company</span>
                    <span className="val">{inspectedLead.company || '—'}</span>
                  </div>
                  <div className="leads-dossier-field">
                    <span className="label">Work Email</span>
                    <span className="val">
                      {inspectedLead.email ? (
                        <>
                          <a href={`mailto:${inspectedLead.email}`} style={{ color: 'var(--sp-brand)' }}>
                            {inspectedLead.email}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inspectedLead.email!, 'Email')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            title="Copy email"
                          >
                            <Copy size={11} color="var(--sp-text-muted)" />
                          </button>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="leads-dossier-field">
                    <span className="label">Phone</span>
                    <span className="val">
                      {inspectedLead.phone ? (
                        <>
                          <a href={`tel:${inspectedLead.phone}`} style={{ color: 'var(--sp-text)' }}>
                            {inspectedLead.phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inspectedLead.phone!, 'Phone')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            title="Copy phone"
                          >
                            <Copy size={11} color="var(--sp-text-muted)" />
                          </button>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="leads-dossier-field">
                    <span className="label">Source</span>
                    <span className="val">{inspectedLead.source || 'Direct outreach'}</span>
                  </div>
                  <div className="leads-dossier-field">
                    <span className="label">Branch</span>
                    <span className="val">
                      {branches.find((b) => b.id === inspectedLead.branchId)?.name || 'Default Branch'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scheduled Next Action Card */}
              <div className="leads-drawer-next-action-card">
                <div className="leads-drawer-next-action-header">
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-brand)', textTransform: 'uppercase' }}>
                    Scheduled Next Action
                  </span>
                  {inspectedLead.nextActivityAt && (
                    <span className={`lead-action-pill ${isOverdue(inspectedLead.nextActivityAt) ? 'overdue' : 'scheduled'}`}>
                      <Clock size={11} />
                      {isOverdue(inspectedLead.nextActivityAt) ? 'Overdue · ' : 'Due · '}
                      {formatDate(inspectedLead.nextActivityAt)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  {inspectedLead.nextActivityTitle || 'No immediate action scheduled'}
                </div>
                {inspectedLead.nextActivityTitle && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      onClick={async () => {
                        await send(`/leads/${inspectedLead.id}/activities`, 'POST', {
                          activityType: 'TASK',
                          body: `Completed scheduled action: ${inspectedLead.nextActivityTitle}`
                        });
                        await send(`/leads/${inspectedLead.id}`, 'PATCH', {
                          nextActivityTitle: null,
                          nextActivityAt: null
                        });
                        notify('Scheduled action marked as completed');
                      }}
                    >
                      <Check size={12} />
                      Mark Completed
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Activity Logger Form */}
              <div className="lead-inline-activity-box" style={{ background: 'var(--sp-surface-subtle)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '8px' }}>
                  Record Note / Activity
                </div>
                <form onSubmit={(e) => addActivity(e, inspectedLead)}>
                  <div className="lead-inline-activity-top">
                    <select name="activityType" defaultValue="NOTE">
                      <option value="NOTE">Note</option>
                      <option value="CALL">Call</option>
                      <option value="EMAIL">Email</option>
                      <option value="MEETING">Meeting</option>
                      <option value="TASK">Task</option>
                    </select>
                    <input name="dueAt" type="datetime-local" title="Due date (optional)" />
                  </div>
                  <textarea
                    name="body"
                    required
                    maxLength={2000}
                    placeholder="Add activity recap, customer feedback, next steps…"
                    style={{ width: '100%', minHeight: '60px', marginTop: '6px', fontSize: '12px', padding: '8px', border: '1px solid var(--sp-border)', borderRadius: '4px' }}
                  />
                  <div className="lead-inline-activity-bottom">
                    <button
                      type="submit"
                      className="button button-primary"
                      style={{ height: '28px', padding: '0 12px', fontSize: '11.5px' }}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Timeline Feed */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '10px' }}>
                  Activity Timeline ({inspectedLead.activities?.length || 0})
                </div>
                {(!inspectedLead.activities || inspectedLead.activities.length === 0) ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                    No timeline events recorded yet.
                  </div>
                ) : (
                  <div className="leads-timeline-feed">
                    {inspectedLead.activities.map((act) => (
                      <div key={act.id} className="leads-timeline-item">
                        <div className="leads-timeline-icon">
                          {renderActivityIcon(act.activityType)}
                        </div>
                        <div className="leads-timeline-content">
                          <div className="leads-timeline-top">
                            <span style={{ fontWeight: 600, color: 'var(--sp-text)' }}>
                              {act.activityType}
                            </span>
                            <time style={{ color: 'var(--sp-text-muted)' }}>
                              {formatDate(act.createdAt)}
                            </time>
                          </div>
                          <p className="leads-timeline-text">{act.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
