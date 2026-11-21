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
  { id: 'NEW', label: 'New', color: 'var(--sp-info, #2763A5)', desc: 'Newly captured prospect' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'var(--sp-warning, #8B5A17)', desc: 'Budget & requirements verified' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'var(--sp-brand, #5E6AD2)', desc: 'Commercial quotation sent' },
  { id: 'WON', label: 'Won', color: 'var(--sp-success, #1A7A4C)', desc: 'Converted to customer' },
  { id: 'LOST', label: 'Lost', color: 'var(--sp-text-muted, #8A8F98)', desc: 'Disqualified or closed' }
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
        return <PhoneCall size={11} color="var(--sp-info, #2763A5)" />;
      case 'EMAIL':
        return <Mail size={11} color="var(--sp-brand, #5E6AD2)" />;
      case 'MEETING':
        return <UserCheck size={11} color="var(--sp-success, #1A7A4C)" />;
      case 'TASK':
        return <CheckSquare size={11} color="var(--sp-warning, #8B5A17)" />;
      default:
        return <FileText size={11} color="var(--sp-text-muted, #8A8F98)" />;
    }
  };

  // Visible stages for responsive board layout (zero horizontal scroll)
  const visibleStages = useMemo(() => {
    return STAGES.filter((s) => selectedStageFilter === 'ALL' || selectedStageFilter === s.id);
  }, [selectedStageFilter]);

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
              <span style={{ color: 'var(--sp-danger, #C13E3E)' }}>{metrics.overdueCount} Overdue</span>
            ) : (
              'On Track'
            )}
          </div>
          <div className="lead-metric-sub">
            {metrics.openCount} prospects in active sequence
          </div>
        </div>
      </div>

      {/* 2. Linear Unified Toolbar & Common Filters (No Loose Tabs) */}
      <div className="leads-toolbar">
        <div className="leads-toolbar-top">
          {/* Left: View Switcher & Structured Common Filters */}
          <div className="leads-toolbar-left">
            <div className="leads-view-toggle">
              <button
                type="button"
                className={`leads-view-btn ${view === 'board' ? 'active' : ''}`}
                onClick={() => setView('board')}
                title="Board View"
              >
                <Kanban size={13} />
                <span>Board</span>
              </button>
              <button
                type="button"
                className={`leads-view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List View"
              >
                <LayoutList size={13} />
                <span>List</span>
              </button>
            </div>

            <div className="leads-toolbar-sep" />

            {/* Common Filter: Stage Filter Dropdown */}
            <div className="leads-filter-group">
              <select
                aria-label="Filter by stage"
                className="leads-filter-dropdown"
                value={selectedStageFilter}
                onChange={(e) => {
                  setSelectedStageFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Stages ({leads.length})</option>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({stageCounts[s.id]?.count || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Common Filter 2: Branch (if applicable) */}
            {branches.length > 1 && (
              <div className="leads-filter-group">
                <select
                  aria-label="Filter by branch"
                  className="leads-filter-dropdown"
                  value={selectedBranchFilter}
                  onChange={(e) => {
                    setSelectedBranchFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filters Shortcut Button */}
            {(selectedStageFilter !== 'ALL' || selectedBranchFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                className="leads-reset-btn"
                onClick={() => {
                  setSelectedStageFilter('ALL');
                  setPresetFilter('ALL');
                  setSelectedBranchFilter('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                title="Reset all filters"
              >
                <X size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Search Box & New Lead Action */}
          <div className="leads-toolbar-right">
            <div className="sales-search-box" style={{ width: '280px', height: '32px' }}>
              <Search size={13} className="sales-search-icon" />
              <input
                type="text"
                className="sales-search-input"
                placeholder="Filter leads by name, company, contact…"
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
              className="sales-action-btn primary"
              style={{ height: '32px', gap: '5px' }}
              onClick={() => {
                setShowCreatePanel(!showCreatePanel);
                setCreateInitialStage('NEW');
              }}
            >
              <Plus size={13} />
              <span>{showCreatePanel ? 'Close form' : 'New lead'}</span>
            </button>
          </div>
        </div>

        {/* Active Filters Telemetry Bar */}
        {(selectedStageFilter !== 'ALL' || selectedBranchFilter !== 'ALL' || searchQuery) && (
          <div className="leads-active-filters-bar">
            <span className="leads-active-label">Active Filters:</span>
            {selectedStageFilter !== 'ALL' && (
              <span className="leads-active-tag">
                Stage: {STAGES.find((s) => s.id === selectedStageFilter)?.label || selectedStageFilter}
                <button type="button" onClick={() => setSelectedStageFilter('ALL')}>
                  <X size={10} />
                </button>
              </span>
            )}
            {selectedBranchFilter !== 'ALL' && (
              <span className="leads-active-tag">
                Branch: {branches.find((b) => b.id === selectedBranchFilter)?.name || selectedBranchFilter}
                <button type="button" onClick={() => setSelectedBranchFilter('ALL')}>
                  <X size={10} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="leads-active-tag">
                Search: "{searchQuery}"
                <button type="button" onClick={() => setSearchQuery('')}>
                  <X size={10} />
                </button>
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
              Showing {processedLeads.length} of {leads.length} prospects
            </span>
          </div>
        )}
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
          <Sparkles size={24} style={{ color: 'var(--sp-brand, #5E6AD2)', marginBottom: '8px' }} />
          <h3>No prospects in pipeline</h3>
          <p>Click "New lead" above to capture prospects and start moving deals forward.</p>
        </div>
      ) : view === 'board' ? (
        /* COMPACT HIGH-SCALE KANBAN BOARD VIEW */
        <div
          className="leads-board-container"
          style={{
            gridTemplateColumns: visibleStages.length === 1
              ? 'minmax(320px, 460px)'
              : `repeat(${visibleStages.length}, minmax(0, 1fr))`
          }}
        >
          {visibleStages.map((stageItem) => {
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
                                style={{ background: 'var(--sp-success-soft)', color: 'var(--sp-success)' }}
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
                    style={{ cursor: 'pointer', accentColor: 'var(--sp-brand, #5E6AD2)' }}
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
                          style={{ cursor: 'pointer', accentColor: 'var(--sp-brand, #5E6AD2)' }}
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

      {/* Linear-Grade Slide-Over Lead Inspector Drawer */}
      {inspectedLead && (
        <div className="leads-drawer-backdrop" onClick={() => setSelectedLeadId(null)}>
          <div className="leads-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="leads-drawer-header">
              <div className="leads-drawer-header-left">
                <div className="leads-drawer-meta-breadcrumb">
                  <span>Leads</span>
                  <span className="leads-drawer-crumb-sep">/</span>
                  <span className="leads-drawer-id">#{inspectedLead.id.slice(0, 8)}</span>
                </div>
                <h2 className="leads-drawer-h2">{inspectedLead.company || inspectedLead.name}</h2>
                {inspectedLead.company && (
                  <div className="leads-drawer-sub">
                    <User size={12} style={{ color: 'var(--sp-text-muted)' }} />
                    <span>{inspectedLead.name}</span>
                  </div>
                )}
              </div>
              <div className="leads-drawer-header-right">
                {inspectedLead.expectedValue != null && (
                  <span className="leads-drawer-value-tag" title="Deal Value">
                    {formatCurrency(inspectedLead.expectedValue)}
                  </span>
                )}
                {!inspectedLead.convertedCustomerId && inspectedLead.stage !== 'WON' ? (
                  <button
                    type="button"
                    className="leads-drawer-convert-btn"
                    onClick={() => {
                      setConvertModalLead(inspectedLead);
                      setConvertWithQuote(false);
                      setConvertItemId(items[0]?.id || '');
                      setConvertQuantity(1);
                      setConvertUnitPrice(Number(items[0]?.unitPrice) || 0);
                    }}
                    title="Convert to Customer & Quote"
                  >
                    <UserCheck size={13} />
                    <span>Convert</span>
                  </button>
                ) : (
                  <span className="leads-drawer-converted-badge">
                    <Check size={12} />
                    <span>Converted</span>
                  </span>
                )}
                <button
                  type="button"
                  className="leads-modal-close-btn"
                  onClick={() => setSelectedLeadId(null)}
                  title="Close (Esc)"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Linear Stage Segmented Progress Bar */}
            <div className="leads-drawer-stepper-wrap">
              <div className="leads-linear-stepper">
                {STAGES.map((s) => {
                  const isCurrent = inspectedLead.stage === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`leads-linear-step-btn ${isCurrent ? 'active' : ''}`}
                      disabled={saving || (s.id === 'WON' && !inspectedLead.convertedCustomerId)}
                      onClick={() => stage(inspectedLead, s.id)}
                      title={s.desc}
                    >
                      <span className="leads-step-dot" style={{ backgroundColor: s.color }} />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="leads-drawer-body">
              {/* Linear Properties Section */}
              <div className="leads-properties-section">
                <div className="leads-section-label">Properties</div>
                <div className="leads-properties-list">
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Status</span>
                    <div className="leads-prop-val">
                      <span
                        className="leads-step-dot"
                        style={{
                          backgroundColor: STAGES.find((s) => s.id === inspectedLead.stage)?.color || 'var(--sp-brand)'
                        }}
                      />
                      <span>{STAGES.find((s) => s.id === inspectedLead.stage)?.label || inspectedLead.stage}</span>
                    </div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Deal Value</span>
                    <div className="leads-prop-val" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {inspectedLead.expectedValue != null ? formatCurrency(inspectedLead.expectedValue) : '—'}
                    </div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Contact</span>
                    <div className="leads-prop-val">{inspectedLead.name}</div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Company</span>
                    <div className="leads-prop-val">{inspectedLead.company || '—'}</div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Work Email</span>
                    <div className="leads-prop-val">
                      {inspectedLead.email ? (
                        <div className="leads-prop-link-group">
                          <a href={`mailto:${inspectedLead.email}`} className="leads-prop-link">
                            {inspectedLead.email}
                          </a>
                          <button
                            type="button"
                            className="leads-prop-copy-btn"
                            onClick={() => copyToClipboard(inspectedLead.email!, 'Email')}
                            title="Copy email"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Phone</span>
                    <div className="leads-prop-val">
                      {inspectedLead.phone ? (
                        <div className="leads-prop-link-group">
                          <a href={`tel:${inspectedLead.phone}`} className="leads-prop-link">
                            {inspectedLead.phone}
                          </a>
                          <button
                            type="button"
                            className="leads-prop-copy-btn"
                            onClick={() => copyToClipboard(inspectedLead.phone!, 'Phone')}
                            title="Copy phone"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Source</span>
                    <div className="leads-prop-val">{inspectedLead.source || 'Direct outreach'}</div>
                  </div>
                  <div className="leads-prop-row">
                    <span className="leads-prop-key">Branch</span>
                    <div className="leads-prop-val">
                      {branches.find((b) => b.id === inspectedLead.branchId)?.name || 'Default Branch'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduled Next Action Strip */}
              <div className="leads-next-action-strip">
                <div className="leads-next-action-top">
                  <div className="leads-next-action-label">
                    <Calendar size={12} />
                    <span>Scheduled Next Action</span>
                  </div>
                  {inspectedLead.nextActivityAt && (
                    <span className={`leads-action-status-tag ${isOverdue(inspectedLead.nextActivityAt) ? 'overdue' : 'scheduled'}`}>
                      <Clock size={11} />
                      {isOverdue(inspectedLead.nextActivityAt) ? 'Overdue · ' : 'Due · '}
                      {formatDate(inspectedLead.nextActivityAt)}
                    </span>
                  )}
                </div>
                <div className="leads-next-action-body">
                  {inspectedLead.nextActivityTitle || 'No immediate action scheduled'}
                </div>
                {inspectedLead.nextActivityTitle && (
                  <div className="leads-next-action-footer">
                    <button
                      type="button"
                      className="leads-next-action-complete-btn"
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
                      <span>Mark Completed</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Linear Activity Composer */}
              <div className="leads-composer-card">
                <form onSubmit={(e) => addActivity(e, inspectedLead)}>
                  <textarea
                    name="body"
                    required
                    maxLength={2000}
                    className="leads-composer-textarea"
                    placeholder="Write an activity note, call summary, or next step… (⌘ Enter to save)"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <div className="leads-composer-footer">
                    <div className="leads-composer-tools">
                      <select name="activityType" defaultValue="NOTE" className="leads-composer-type-select">
                        <option value="NOTE">Note</option>
                        <option value="CALL">Call</option>
                        <option value="EMAIL">Email</option>
                        <option value="MEETING">Meeting</option>
                        <option value="TASK">Task</option>
                      </select>
                      <div className="leads-composer-date-wrap">
                        <Clock size={11} style={{ color: 'var(--sp-text-muted)' }} />
                        <input
                          name="dueAt"
                          type="datetime-local"
                          className="leads-composer-date-input"
                          title="Due date (optional)"
                        />
                      </div>
                    </div>
                    <div className="leads-composer-actions">
                      <span className="leads-composer-hint">⌘+Enter to log</span>
                      <button
                        type="submit"
                        className="leads-composer-submit-btn"
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Log Activity'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Linear Activity Timeline */}
              <div className="leads-timeline-section">
                <div className="leads-section-label">
                  Activity Feed ({inspectedLead.activities?.length || 0})
                </div>
                {(!inspectedLead.activities || inspectedLead.activities.length === 0) ? (
                  <div className="leads-timeline-empty">
                    <span>No timeline events recorded yet.</span>
                  </div>
                ) : (
                  <div className="leads-linear-timeline">
                    {inspectedLead.activities.map((act) => (
                      <div key={act.id} className="leads-timeline-entry">
                        <div className="leads-timeline-node">
                          {renderActivityIcon(act.activityType)}
                        </div>
                        <div className="leads-timeline-bubble">
                          <div className="leads-timeline-header">
                            <span className="leads-timeline-type-pill">{act.activityType}</span>
                            <time className="leads-timeline-time">{formatDate(act.createdAt)}</time>
                          </div>
                          <p className="leads-timeline-body">{act.body}</p>
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
                <UserCheck size={16} color="var(--sp-brand, #5E6AD2)" />
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
                    <span style={{ fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>
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
                      style={{ width: '16px', height: '16px', accentColor: 'var(--sp-brand, #5E6AD2)' }}
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
                          <span style={{ color: 'var(--sp-brand, #5E6AD2)', fontVariantNumeric: 'tabular-nums' }}>
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
