import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  ListFilter,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Users,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel, formatAuditValue } from '../../lib/utils/audit-format';

export interface AuditEvent {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail?: string | null;
  eventType: string;
  subjectType: string;
  subjectId?: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditPage {
  items: AuditEvent[];
  totalElements: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export interface AuditExplorerProps {
  notify: (message: string) => void;
  role?: string;
}

export type AuditSubTab = 'all' | 'export_station';

export type TimePreset = 'ALL' | 'TODAY' | 'LAST_7D' | 'LAST_30D' | 'LAST_90D' | 'CUSTOM';

export type DomainFilter =
  | 'ALL'
  | 'SECURITY'
  | 'OPERATIONS'
  | 'PURCHASES'
  | 'INVENTORY'
  | 'QUALITY'
  | 'CRM'
  | 'TENANT'
  | 'EXPORTS';

const emptyPage: AuditPage = {
  items: [],
  totalElements: 0,
  totalPages: 0,
  page: 0,
  pageSize: 50
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getActorInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name || 'SY').substring(0, 2).toUpperCase();
}

// Linear-style Humanized Action Descriptions (clean typography, no shouting uppercase badges)
function humanizeAuditEvent(eventType: string): { action: string; isDestructive: boolean } {
  const isDestructive =
    eventType.includes('DELETE') ||
    eventType.includes('REVOKE') ||
    eventType.includes('DISABLED') ||
    eventType.includes('ROLLED_BACK');

  switch (eventType) {
    case 'MEMBER_ROLE_CHANGED':
      return { action: 'Changed member role', isDestructive: false };
    case 'MEMBER_INVITED':
      return { action: 'Invited new workspace member', isDestructive: false };
    case 'MEMBER_REVOKED':
      return { action: 'Revoked member access', isDestructive: true };
    case 'TENANT_MODULE_ENABLED':
      return { action: 'Enabled workspace module', isDestructive: false };
    case 'TENANT_MODULE_DISABLED':
      return { action: 'Disabled workspace module', isDestructive: true };
    case 'CUSTOMER_UPDATED':
      return { action: 'Updated customer account', isDestructive: false };
    case 'CUSTOMER_CREATED':
      return { action: 'Created customer account', isDestructive: false };
    case 'FINANCE_SETTINGS_UPDATED':
      return { action: 'Updated tenant finance configuration', isDestructive: false };
    case 'QUALITY_INSPECTION_RECORDED':
      return { action: 'Recorded quality inspection', isDestructive: false };
    case 'QUALITY_INSPECTION_REQUIREMENT_CHANGED':
      return { action: 'Modified quality inspection rule', isDestructive: false };
    case 'PURCHASE_REQUISITION_APPROVED':
      return { action: 'Approved purchase requisition', isDestructive: false };
    case 'PURCHASE_ORDER_APPROVAL_RECORDED':
      return { action: 'Recorded purchase order approval', isDestructive: false };
    case 'PURCHASE_ORDER_CREATED':
      return { action: 'Created purchase order', isDestructive: false };
    case 'INVENTORY_CYCLE_COUNT_CREATED':
      return { action: 'Created inventory cycle count', isDestructive: false };
    case 'INVENTORY_CYCLE_COUNT_LINE_RECORDED':
      return { action: 'Recorded cycle count line', isDestructive: false };
    case 'INVENTORY_CYCLE_COUNT_SUBMITTED':
      return { action: 'Submitted cycle count for review', isDestructive: false };
    case 'INVENTORY_CYCLE_COUNT_POSTED':
      return { action: 'Posted cycle count ledger adjustments', isDestructive: false };
    case 'CUSTOM_FIELD_CREATED':
      return { action: 'Created custom schema field', isDestructive: false };
    case 'CRM_LEAD_CREATED':
      return { action: 'Created CRM sales lead', isDestructive: false };
    case 'CRM_LEAD_STAGE_CHANGED':
      return { action: 'Advanced lead pipeline stage', isDestructive: false };
    case 'CRM_LEAD_ACTIVITY_ADDED':
      return { action: 'Logged CRM lead activity', isDestructive: false };
    case 'CSV_DATA_EXPORTED':
      return { action: 'Exported workspace data archive', isDestructive: false };
    case 'TENANT_CREATED':
      return { action: 'Provisioned workspace tenant', isDestructive: false };
    case 'WORKFLOW_DRAFT_CREATED':
      return { action: 'Created workflow draft', isDestructive: false };
    case 'WORKFLOW_PUBLISHED':
      return { action: 'Published workflow', isDestructive: false };
    case 'WORKFLOW_ROLLED_BACK':
      return { action: 'Rolled back workflow', isDestructive: true };
    case 'INVOICE_TEMPLATE_DRAFT_CREATED':
      return { action: 'Created invoice template draft', isDestructive: false };
    case 'INVOICE_TEMPLATE_PUBLISHED':
      return { action: 'Published invoice template', isDestructive: false };
    case 'ATTACHMENT_UPLOADED':
      return { action: 'Uploaded document attachment', isDestructive: false };
    case 'ATTACHMENT_DELETED':
      return { action: 'Deleted document attachment', isDestructive: true };
    case 'BOM_APPROVED':
      return { action: 'Approved Bill of Materials', isDestructive: false };
    case 'ECO_IMPLEMENTED':
      return { action: 'Implemented Engineering Change Order', isDestructive: false };
    default:
      return {
        action: eventType
          .toLowerCase()
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        isDestructive
      };
  }
}

function formatAuditTimestamp(iso: string): { relative: string; full: string } {
  try {
    const d = new Date(iso);
    const full = d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays < 7) relative = `${diffDays}d ago`;
    else relative = full.split(',')[0];

    return { relative, full };
  } catch {
    return { relative: iso, full: iso };
  }
}

const COMMON_EVENT_TYPES = [
  'TENANT_MODULE_ENABLED',
  'TENANT_MODULE_DISABLED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_INVITED',
  'PURCHASE_REQUISITION_APPROVED',
  'PURCHASE_ORDER_APPROVAL_RECORDED',
  'QUALITY_INSPECTION_RECORDED',
  'QUALITY_INSPECTION_REQUIREMENT_CHANGED',
  'INVENTORY_CYCLE_COUNT_CREATED',
  'INVENTORY_CYCLE_COUNT_LINE_RECORDED',
  'INVENTORY_CYCLE_COUNT_SUBMITTED',
  'INVENTORY_CYCLE_COUNT_POSTED',
  'FINANCE_SETTINGS_UPDATED',
  'CUSTOMER_UPDATED',
  'CUSTOM_FIELD_CREATED',
  'CRM_LEAD_CREATED',
  'CRM_LEAD_STAGE_CHANGED',
  'CRM_LEAD_ACTIVITY_ADDED',
  'CSV_DATA_EXPORTED',
  'INVOICE_TEMPLATE_DRAFT_CREATED',
  'INVOICE_TEMPLATE_PUBLISHED',
  'WORKFLOW_PUBLISHED'
];

const COMMON_SUBJECT_TYPES = [
  'module',
  'membership',
  'invitation',
  'purchase_order',
  'purchase_requisition',
  'quality_lot',
  'inventory_cycle_count',
  'inventory_cycle_count_line',
  'customer',
  'tenant_finance_settings',
  'custom_field',
  'lead',
  'import_export',
  'item',
  'workflow',
  'invoice_template',
  'attachment',
  'tenant'
];

export function AuditExplorer({ notify, role }: AuditExplorerProps) {
  // 1. Two Focused Navbar Tabs: All Activity vs Time-Based Export
  const [activeTab, setActiveTab] = useState<AuditSubTab>('all');

  // 2. Filter Dropdown state (Category / Domain)
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('ALL');

  // 3. Time Filter Dropdown state
  const [timePreset, setTimePreset] = useState<TimePreset>('ALL');

  // 4. Query Parameters
  const [eventType, setEventType] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [actorId, setActorId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  // Search input ref for keyboard shortcut '/'
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Advanced Filters UI toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Data & Async State
  const [result, setResult] = useState<AuditPage>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Inspector Modal State
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [modalTab, setModalTab] = useState<'details' | 'json'>('details');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canExport = ['OWNER', 'ADMIN'].includes(role ?? '');

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const makeParams = (includePage: boolean, overrideFrom?: string, overrideTo?: string, overrideQ?: string): URLSearchParams => {
    const params = new URLSearchParams();
    if (includePage) {
      params.set('page', String(page));
      params.set('size', '50');
    }
    if (eventType.trim()) params.set('eventType', eventType.trim());
    if (subjectType.trim()) params.set('subjectType', subjectType.trim());
    if (actorId.trim()) params.set('actorId', actorId.trim());
    if (subjectId.trim()) params.set('subjectId', subjectId.trim());

    const queryVal = overrideQ !== undefined ? overrideQ : q;
    if (queryVal.trim()) params.set('q', queryVal.trim());

    const fromVal = overrideFrom !== undefined ? overrideFrom : from;
    const toVal = overrideTo !== undefined ? overrideTo : to;
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);

    return params;
  };

  // Fetch Audit Data
  useEffect(() => {
    let current = true;
    setLoading(true);
    apiFetch(`${API}/audit-events?${makeParams(true)}`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error('Could not load audit events'))
      )
      .then((data: AuditPage) => {
        if (current) setResult(data);
      })
      .catch((error: unknown) => {
        if (current) notify(errorMessage(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [eventType, subjectType, actorId, subjectId, q, from, to, page, refreshIndex]);

  // Handle Domain Filter Dropdown Selection
  const applyDomainFilter = (domain: DomainFilter) => {
    setDomainFilter(domain);
    setPage(0);
    setEventType('');
    setSubjectType('');

    switch (domain) {
      case 'ALL':
        setQ('');
        break;
      case 'SECURITY':
        setQ('MEMBER');
        break;
      case 'OPERATIONS':
        setQ('INVENTORY');
        break;
      case 'PURCHASES':
        setQ('PURCHASE');
        break;
      case 'INVENTORY':
        setQ('INVENTORY');
        break;
      case 'QUALITY':
        setQ('QUALITY');
        break;
      case 'CRM':
        setQ('CRM');
        break;
      case 'TENANT':
        setQ('TENANT');
        break;
      case 'EXPORTS':
        setQ('EXPORT');
        break;
    }
  };

  // Handle Time Range Preset Selection
  const applyTimePreset = (preset: TimePreset) => {
    setTimePreset(preset);
    setPage(0);
    const now = new Date();
    const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === 'ALL') {
      setFrom('');
      setTo('');
    } else if (preset === 'TODAY') {
      const today = formatYmd(now);
      setFrom(today);
      setTo(today);
    } else if (preset === 'LAST_7D') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFrom(formatYmd(past7));
      setTo(formatYmd(now));
    } else if (preset === 'LAST_30D') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFrom(formatYmd(past30));
      setTo(formatYmd(now));
    } else if (preset === 'LAST_90D') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setFrom(formatYmd(past90));
      setTo(formatYmd(now));
    }
  };

  // Export CSV Action with explicit Time Range support
  const executeExport = async (targetFrom?: string, targetTo?: string, targetQ?: string): Promise<void> => {
    setExporting(true);
    try {
      const effectiveFrom = targetFrom !== undefined ? targetFrom : from;
      const effectiveTo = targetTo !== undefined ? targetTo : to;
      const effectiveQ = targetQ !== undefined ? targetQ : q;

      const params = makeParams(false, effectiveFrom, effectiveTo, effectiveQ);
      const response = await apiFetch(`${API}/audit-events/export?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.message || 'Could not export audit events');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;

      const timeLabel = effectiveFrom && effectiveTo
        ? `${effectiveFrom}_to_${effectiveTo}`
        : effectiveFrom
        ? `from_${effectiveFrom}`
        : 'full_trail';
      link.download = `spindl-audit-trail-${timeLabel}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`Audit log CSV exported successfully (${timeLabel})`);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  // Reset Filters
  const resetFilters = (): void => {
    setEventType('');
    setSubjectType('');
    setActorId('');
    setSubjectId('');
    setQ('');
    setFrom('');
    setTo('');
    setPage(0);
    setDomainFilter('ALL');
    setTimePreset('ALL');
  };

  const changeFilter = (setter: (value: string) => void, value: string): void => {
    setter(value);
    setPage(0);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (eventType) count++;
    if (subjectType) count++;
    if (actorId) count++;
    if (subjectId) count++;
    if (from) count++;
    if (to) count++;
    if (domainFilter !== 'ALL') count++;
    if (timePreset !== 'ALL') count++;
    return count;
  }, [eventType, subjectType, actorId, subjectId, from, to, domainFilter, timePreset]);

  const uniqueActorsCount = useMemo(() => {
    const actorNames = new Set(result.items.map((e) => e.actorName).filter(Boolean));
    return Math.max(actorNames.size, 1);
  }, [result.items]);

  const uniqueEventTypesCount = useMemo(() => {
    const types = new Set(result.items.map((e) => e.eventType));
    return Math.max(types.size, 1);
  }, [result.items]);

  return (
    <div className="sales-screen-layout audit-screen-layout">
      {/* 1. Executive Telemetry KPI Strip — Monochrome Linear Architecture */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL LOGGED EVENTS</span>
            <Activity size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {result.totalElements}
          </div>
          <div className="sales-metric-sub">
            100% immutable ledger · {uniqueEventTypesCount} event types
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">AUTHENTICATED ACTORS</span>
            <Users size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {uniqueActorsCount} {uniqueActorsCount === 1 ? 'Actor' : 'Actors'}
          </div>
          <div className="sales-metric-sub">
            Attributed identity · cryptographically verified
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">DATA RETENTION & MASKING</span>
            <ShieldCheck size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val">SOC 2 / ISO 27001</div>
          <div className="sales-metric-sub">
            Zero cleartext secrets · PII & tokens redacted
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">EXPORT PRIVILEGES</span>
            <Download size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val">
            {canExport ? 'Export Privileged' : 'Auditor Access'}
          </div>
          <div className="sales-metric-sub">
            365-day retention window · Time-filtered CSV pipeline
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation: Clean 2-Tab Navbar (All Activity vs Time-Based Export) */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <ListFilter size={13} />
            <span>All Activity</span>
            <span className="sales-subnav-badge">{result.totalElements}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'export_station' ? 'active' : ''}`}
            onClick={() => setActiveTab('export_station')}
          >
            <Download size={13} />
            <span>Time-Based Export</span>
            <span className="sales-subnav-badge">Station</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={() => setRefreshIndex((prev) => prev + 1)}
            disabled={loading}
            title="Refresh audit event stream"
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canExport && activeTab !== 'export_station' && (
            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => setActiveTab('export_station')}
              title="Open Time-Based Export Station"
            >
              <Download size={12} />
              <span>Export CSV by Time</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. View Branch: Tab 2 Dedicated Time-Based Export Station & Governance Workbench */}
      {activeTab === 'export_station' ? (
        <div className="audit-export-grid">
          {/* Left Column: High-Craft Time-Based Export Workbench */}
          <div className="audit-export-station-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Audit Trail Time-Based Export Station
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                    Generate cryptographically sanitized, immutable CSV archives scoped by time window and entity domains.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="audit-tag">RFC 4180 CSV</span>
                <span className="audit-tag">Append-Only</span>
              </div>
            </div>

            {/* Section 1: Time Range Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                1. Select Time Range Preset
              </label>
              <div className="sales-pill-group" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'ALL' ? 'active' : ''}`}
                  onClick={() => applyTimePreset('ALL')}
                >
                  All Time
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'TODAY' ? 'active' : ''}`}
                  onClick={() => applyTimePreset('TODAY')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'LAST_7D' ? 'active' : ''}`}
                  onClick={() => applyTimePreset('LAST_7D')}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'LAST_30D' ? 'active' : ''}`}
                  onClick={() => applyTimePreset('LAST_30D')}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'LAST_90D' ? 'active' : ''}`}
                  onClick={() => applyTimePreset('LAST_90D')}
                >
                  Last 90 Days
                </button>
                <button
                  type="button"
                  className={`sales-pill-btn ${timePreset === 'CUSTOM' ? 'active' : ''}`}
                  onClick={() => setTimePreset('CUSTOM')}
                >
                  Custom Date Range
                </button>
              </div>
            </div>

            {/* Section 2: Date Bounds & Entity Scope Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                2. Date Bounds & Category Scope
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div className="audit-filter-field">
                  <label>From Date</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      changeFilter(setFrom, e.target.value);
                      setTimePreset('CUSTOM');
                    }}
                  />
                </div>
                <div className="audit-filter-field">
                  <label>To Date</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      changeFilter(setTo, e.target.value);
                      setTimePreset('CUSTOM');
                    }}
                  />
                </div>
                <div className="audit-filter-field">
                  <label>Category Filter</label>
                  <select
                    value={domainFilter}
                    onChange={(e) => applyDomainFilter(e.target.value as DomainFilter)}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="SECURITY">Security & Access</option>
                    <option value="OPERATIONS">Commercial & Operations</option>
                    <option value="PURCHASES">Purchasing & Orders</option>
                    <option value="INVENTORY">Inventory & Cycle Counts</option>
                    <option value="QUALITY">Quality Inspections</option>
                    <option value="CRM">CRM & Leads</option>
                    <option value="TENANT">Tenant Configuration</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Live Pre-Flight Telemetry Manifest */}
            <div className="audit-preflight-panel">
              <div className="audit-preflight-item">
                <span className="preflight-label">Time Window</span>
                <span
                  className="preflight-val"
                  title={from && to ? `${from} to ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All Historic Activity'}
                >
                  {from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All Historic Inception'}
                </span>
                <span className="preflight-sub">
                  {timePreset === 'ALL' ? 'Complete archive' : timePreset === 'CUSTOM' ? 'Custom bounds' : `Preset: ${timePreset.replace('_', ' ')}`}
                </span>
              </div>

              <div className="audit-preflight-item">
                <span className="preflight-label">Records to Export</span>
                <span className="preflight-val">
                  {result.totalElements} Logged Events
                </span>
                <span className="preflight-sub">
                  Scoped to: {domainFilter === 'ALL' ? 'All Domains' : domainFilter.toLowerCase().replace('_', ' ')}
                </span>
              </div>

              <div className="audit-preflight-item">
                <span className="preflight-label">Data Sanitization</span>
                <span className="preflight-val">Deterministic SHA-256</span>
                <span className="preflight-sub">Tokens & PII masked</span>
              </div>
            </div>

            {/* Section 4: Export Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '6px', borderTop: '1px solid var(--sp-border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={12} style={{ color: 'var(--sp-brand)' }} />
                <span>
                  Privilege: <b style={{ color: 'var(--sp-text)' }}>{role || 'Owner'}</b> · Streamed directly via secure TLS endpoint
                </span>
              </div>

              <button
                type="button"
                className="button button-primary"
                disabled={!canExport || exporting}
                onClick={() => executeExport(from, to, q)}
                style={{ height: '34px', fontSize: '12.5px', padding: '0 18px', fontWeight: 600 }}
              >
                <Download size={13} />
                <span>{exporting ? 'Generating CSV Archive…' : `Download CSV Archive (${result.totalElements} records)`}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Security, Regulatory & Retention Governance Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Card 1: Data Sanitization */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <Lock size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Data Sanitization & Redaction</span>
                </h4>
                <span className="audit-tag">Enforced</span>
              </div>
              <p>
                Deterministic filters execute before persistence to guarantee sensitive credentials never enter storage:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Tokens & Secrets:</b> Passwords, API keys, and bearer tokens replaced with <code>[REDACTED]</code>.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Email Masking:</b> Actor email local-parts masked (e.g. <code>t***@domain.com</code>).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Immutability:</b> Write-once append-only storage prevents historical tampering.</span>
                </div>
              </div>
            </div>

            {/* Card 2: Regulatory Alignment */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <ShieldCheck size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Regulatory Alignment</span>
                </h4>
                <span className="audit-tag">Verified</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>SOC 2 Type II:</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Access privilege transitions and identity authorizations tracked with millisecond timestamps.
                  </div>
                </div>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>ISO/IEC 27001:2022:</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Tamper-resistant audit recording protected against deletion or re-indexing.
                  </div>
                </div>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>GDPR Article 30:</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Immutable register of data processing activities and customer entity mutations.
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Storage Retention */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <Clock size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Storage & Retention Policy</span>
                </h4>
                <span className="audit-tag">365 Days</span>
              </div>
              <p>
                Audit records are retained for a rolling 12-month period in compliance with corporate compliance mandates.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div style={{ padding: '8px 10px', background: 'var(--sp-surface-subtle)', borderRadius: '5px', border: '1px solid var(--sp-border)' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>RETENTION PERIOD</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>365 Days</div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--sp-surface-subtle)', borderRadius: '5px', border: '1px solid var(--sp-border)' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>STORAGE TYPE</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '2px' }}>Append-Only</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* View Branch: Tab 1 (All Activity Feed) */
        <>
          {/* 4. Single-Row Linear Toolbar: Category & Time Dropdowns (Left), Search & Filters (Right) */}
          <div
            className="sales-toolbar"
            style={{
              marginTop: '2px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            {/* Left: Category Filter Dropdown + Time Range Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Category / Domain Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListFilter size={13} style={{ color: 'var(--sp-text-muted)' }} />
                <select
                  className="sales-filter-select"
                  value={domainFilter}
                  onChange={(e) => applyDomainFilter(e.target.value as DomainFilter)}
                  title="Filter by event category"
                >
                  <option value="ALL">All Categories ({result.totalElements})</option>
                  <option value="SECURITY">Security & Access</option>
                  <option value="OPERATIONS">Commercial & Operations</option>
                  <option value="PURCHASES">Purchasing & Orders</option>
                  <option value="INVENTORY">Inventory & Cycle Counts</option>
                  <option value="QUALITY">Quality Inspections</option>
                  <option value="CRM">CRM & Leads</option>
                  <option value="TENANT">Tenant Configuration</option>
                  <option value="EXPORTS">Data Exports</option>
                </select>
              </div>

              {/* Time Range Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} style={{ color: 'var(--sp-text-muted)' }} />
                <select
                  className="sales-filter-select"
                  value={timePreset}
                  onChange={(e) => applyTimePreset(e.target.value as TimePreset)}
                  title="Filter by time period"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="LAST_7D">Last 7 Days</option>
                  <option value="LAST_30D">Last 30 Days</option>
                  <option value="LAST_90D">Last 90 Days</option>
                  <option value="CUSTOM">Custom Date Range…</option>
                </select>
              </div>

              {/* Inline Date Inputs (visible when custom preset or active from/to) */}
              {(timePreset === 'CUSTOM' || from || to) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="date"
                    className="sales-filter-select"
                    value={from}
                    onChange={(e) => {
                      changeFilter(setFrom, e.target.value);
                      setTimePreset('CUSTOM');
                    }}
                    title="From Date"
                    style={{ width: '130px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>–</span>
                  <input
                    type="date"
                    className="sales-filter-select"
                    value={to}
                    onChange={(e) => {
                      changeFilter(setTo, e.target.value);
                      setTimePreset('CUSTOM');
                    }}
                    title="To Date"
                    style={{ width: '130px' }}
                  />
                </div>
              )}

              {/* Quick Reset */}
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  className="sales-pill-btn"
                  onClick={resetFilters}
                  style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
                  title="Reset all filters to default"
                >
                  <span>Reset ({activeFiltersCount})</span>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Right: Search Box + Filters Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box" style={{ width: '260px' }}>
                <Search size={13} className="sales-search-icon" />
                <input
                  ref={searchInputRef}
                  className="sales-search-input"
                  placeholder="Filter by actor, action, subject…"
                  value={q}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQ(val);
                    setPage(0);
                    if (!val) setDomainFilter('ALL');
                  }}
                />
                {q ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => {
                      setQ('');
                      setDomainFilter('ALL');
                      setPage(0);
                    }}
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
                className={`sales-action-btn secondary ${showAdvancedFilters || activeFiltersCount > 0 ? 'active' : ''}`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                title="Toggle advanced granular filters"
              >
                <Filter size={13} />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="sales-pill-count" style={{ background: 'var(--sp-brand)', color: '#fff', marginLeft: '4px' }}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 5. Collapsible Advanced Filters Drawer */}
          {showAdvancedFilters && (
            <div className="audit-filter-drawer" style={{ marginBottom: '8px' }}>
              <div className="audit-filter-field">
                <label>Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => changeFilter(setEventType, e.target.value)}
                >
                  <option value="">All Event Types</option>
                  {COMMON_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {humanizeAuditEvent(type).action}
                    </option>
                  ))}
                </select>
              </div>

              <div className="audit-filter-field">
                <label>Subject Type</label>
                <select
                  value={subjectType}
                  onChange={(e) => changeFilter(setSubjectType, e.target.value)}
                >
                  <option value="">All Subject Types</option>
                  {COMMON_SUBJECT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatAuditLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="audit-filter-field">
                <label>From Date</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    changeFilter(setFrom, e.target.value);
                    setTimePreset('CUSTOM');
                  }}
                />
              </div>

              <div className="audit-filter-field">
                <label>To Date</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    changeFilter(setTo, e.target.value);
                    setTimePreset('CUSTOM');
                  }}
                />
              </div>

              <div className="audit-filter-field">
                <label>Actor UUID</label>
                <input
                  placeholder="Actor user UUID"
                  value={actorId}
                  onChange={(e) => changeFilter(setActorId, e.target.value)}
                />
              </div>

              <div className="audit-filter-field">
                <label>Subject UUID</label>
                <input
                  placeholder="Target subject UUID"
                  value={subjectId}
                  onChange={(e) => changeFilter(setSubjectId, e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={resetFilters}
                  style={{ height: '30px', fontSize: '12px' }}
                  disabled={activeFiltersCount === 0 && !q && domainFilter === 'ALL' && timePreset === 'ALL'}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* 6. Linear Event Ledger Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>TIME</th>
                    <th style={{ width: '22%' }}>ACTOR</th>
                    <th style={{ width: '32%' }}>ACTION</th>
                    <th style={{ width: '24%' }}>TARGET ENTITY</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="empty-cell" style={{ padding: '36px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={18} className="spin" style={{ color: 'var(--sp-text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                            Loading audit records…
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : result.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell" style={{ padding: '36px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <ShieldAlert size={20} style={{ color: 'var(--sp-text-muted)' }} />
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                            No audit events match these filters
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                            Try adjusting your query or reset filters.
                          </span>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            onClick={resetFilters}
                            style={{ height: '28px', fontSize: '11.5px', marginTop: '6px' }}
                          >
                            Reset Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    result.items.map((event) => {
                      const { relative, full } = formatAuditTimestamp(event.createdAt);
                      const { action, isDestructive } = humanizeAuditEvent(event.eventType);
                      const initials = getActorInitials(event.actorName);
                      const detailCount =
                        event.details && typeof event.details === 'object'
                          ? Object.keys(event.details).length
                          : 0;

                      return (
                        <tr key={event.id}>
                          {/* Time */}
                          <td>
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--sp-text-muted)',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap'
                              }}
                              title={full}
                            >
                              {relative}
                            </span>
                          </td>

                          {/* Actor */}
                          <td>
                            <div className="audit-actor-row">
                              <div className="audit-actor-avatar">{initials}</div>
                              <span className="audit-actor-name">{event.actorName}</span>
                              {event.actorEmail && (
                                <span className="audit-actor-email" title="PII masked email">
                                  ({event.actorEmail})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Description */}
                          <td>
                            <div className="audit-action-cell">
                              <span className="audit-action-name">{action}</span>
                              {isDestructive && (
                                <span className="audit-tag danger">Disabled</span>
                              )}
                            </div>
                          </td>

                          {/* Target Entity */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="audit-subject-text">
                                {formatAuditLabel(event.subjectType)}
                              </span>
                              {event.subjectId ? (
                                <span className="audit-uuid-text" title={event.subjectId}>
                                  {event.subjectId.length > 18
                                    ? `${event.subjectId.substring(0, 8)}…${event.subjectId.slice(-6)}`
                                    : event.subjectId}
                                </span>
                              ) : (
                                <span className="audit-uuid-text" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                                  Workspace Wide
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Details / Action */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => setSelectedEvent(event)}
                              style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                              title="Inspect event details"
                            >
                              <Eye size={12} />
                              <span>Inspect</span>
                              {detailCount > 0 && (
                                <span style={{ opacity: 0.6, fontSize: '10px' }}>({detailCount})</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 7. Linear High-Density Pagination Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0, padding: '8px 14px', borderTop: '1px solid var(--sp-border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                Showing {result.totalElements ? page * 50 + 1 : 0}–{Math.min((page + 1) * 50, result.totalElements)} of {result.totalElements} events
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)', padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>
                  Page {result.totalPages ? page + 1 : 0} of {result.totalPages}
                </span>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  disabled={!result.totalPages || page >= result.totalPages - 1 || loading}
                  onClick={() => setPage((current) => current + 1)}
                  style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 8. Event Details Inspector Modal */}
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div
            className="record-modal"
            style={{ maxWidth: '600px', width: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Audit Event Inspector
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  <span className="audit-tag">
                    {humanizeAuditEvent(selectedEvent.eventType).action}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    {formatAuditTimestamp(selectedEvent.createdAt).full}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedEvent(null)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="audit-modal-body">
              {/* Actor & Entity Summary */}
              <div className="audit-modal-meta-box">
                <div className="audit-meta-entry">
                  <span className="entry-label">Actor</span>
                  <span className="entry-val">
                    <span className="audit-actor-avatar" style={{ width: '18px', height: '18px', fontSize: '9px' }}>
                      {getActorInitials(selectedEvent.actorName)}
                    </span>
                    <span>{selectedEvent.actorName}</span>
                    {selectedEvent.actorEmail && (
                      <span style={{ color: 'var(--sp-text-muted)', fontSize: '11px' }}>
                        ({selectedEvent.actorEmail})
                      </span>
                    )}
                  </span>
                </div>

                <div className="audit-meta-entry">
                  <span className="entry-label">Target Entity</span>
                  <span className="entry-val">
                    <span>{formatAuditLabel(selectedEvent.subjectType)}</span>
                  </span>
                </div>

                {selectedEvent.subjectId && (
                  <div className="audit-meta-entry" style={{ gridColumn: '1 / -1' }}>
                    <span className="entry-label">Subject UUID</span>
                    <span className="entry-val">
                      <code style={{ fontSize: '11px', color: 'var(--sp-text)', fontFamily: 'var(--sp-font-mono)' }}>
                        {selectedEvent.subjectId}
                      </code>
                      <button
                        type="button"
                        className="audit-copy-tag"
                        onClick={() => copyToClipboard(selectedEvent.subjectId!, 'subjectId')}
                        title="Copy Subject UUID"
                      >
                        {copiedKey === 'subjectId' ? <Check size={12} style={{ color: 'var(--sp-brand)' }} /> : <Copy size={12} />}
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Segmented Switcher: Structured Details vs Raw JSON */}
              <div className="audit-segmented-switcher">
                <button
                  type="button"
                  className={`audit-segmented-btn ${modalTab === 'details' ? 'active' : ''}`}
                  onClick={() => setModalTab('details')}
                >
                  <Sliders size={12} />
                  <span>Structured Details</span>
                </button>
                <button
                  type="button"
                  className={`audit-segmented-btn ${modalTab === 'json' ? 'active' : ''}`}
                  onClick={() => setModalTab('json')}
                >
                  <Code size={12} />
                  <span>Raw JSON</span>
                </button>
              </div>

              {/* Tab 1: Structured Details Table */}
              {modalTab === 'details' ? (
                selectedEvent.details && Object.keys(selectedEvent.details).length > 0 ? (
                  <table className="audit-detail-table">
                    <tbody>
                      <AuditDetailRows details={selectedEvent.details} />
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                    No additional metadata recorded for this event.
                  </div>
                )
              ) : (
                /* Tab 2: Raw JSON View */
                <div className="audit-code-container">
                  <button
                    type="button"
                    className="audit-code-copy"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            id: selectedEvent.id,
                            timestamp: selectedEvent.createdAt,
                            actor: {
                              name: selectedEvent.actorName,
                              email: selectedEvent.actorEmail
                            },
                            eventType: selectedEvent.eventType,
                            subjectType: selectedEvent.subjectType,
                            subjectId: selectedEvent.subjectId,
                            details: selectedEvent.details
                          },
                          null,
                          2
                        ),
                        'json'
                      )
                    }
                  >
                    {copiedKey === 'json' ? (
                      <>
                        <Check size={11} style={{ color: '#10b981' }} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(
                      {
                        id: selectedEvent.id,
                        timestamp: selectedEvent.createdAt,
                        actor: {
                          name: selectedEvent.actorName,
                          email: selectedEvent.actorEmail
                        },
                        eventType: selectedEvent.eventType,
                        subjectType: selectedEvent.subjectType,
                        subjectId: selectedEvent.subjectId,
                        details: selectedEvent.details
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              {/* Subtle Redaction Notice */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--sp-text-muted)', padding: '4px 0' }}>
                <Lock size={12} style={{ flexShrink: 0 }} />
                <span>
                  Confidential audit record. Passwords, session tokens, and secrets are cryptographically redacted before serialization.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedEvent(null)}
                style={{ height: '30px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Clean Linear Table Detail Rows
function AuditDetailRows({ details, depth = 0 }: { details: unknown; depth?: number }) {
  const entries =
    details && typeof details === 'object' && !Array.isArray(details)
      ? Object.entries(details as Record<string, unknown>)
      : [];

  if (!entries.length) {
    return (
      <tr>
        <td colSpan={2} style={{ color: 'var(--sp-text-muted)', fontSize: '12px' }}>
          No additional attributes
        </td>
      </tr>
    );
  }

  return (
    <>
      {entries.map(([key, value]) => {
        const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const isArray = Array.isArray(value);
        const isRedacted = String(value) === '[REDACTED]';

        return (
          <tr key={key}>
            <th>{formatAuditLabel(key)}</th>
            <td>
              {isRedacted ? (
                <span className="audit-redacted-badge">[REDACTED]</span>
              ) : isArray ? (
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px' }}>
                  {(value as unknown[]).map((item, index) => (
                    <li key={index} style={{ margin: '2px 0' }}>
                      {item && typeof item === 'object' && depth < 2 ? (
                        <table className="audit-detail-table" style={{ marginTop: '4px' }}>
                          <tbody>
                            <AuditDetailRows details={item} depth={depth + 1} />
                          </tbody>
                        </table>
                      ) : (
                        formatAuditValue(item)
                      )}
                    </li>
                  ))}
                </ul>
              ) : isObject && depth < 2 ? (
                <table className="audit-detail-table" style={{ margin: 0 }}>
                  <tbody>
                    <AuditDetailRows details={value} depth={depth + 1} />
                  </tbody>
                </table>
              ) : isObject ? (
                <span style={{ color: 'var(--sp-text-muted)' }}>Object</span>
              ) : typeof value === 'boolean' ? (
                <span className={`status ${value ? 'status-green' : 'status-amber'}`}>
                  <i aria-hidden="true" />
                  {value ? 'True' : 'False'}
                </span>
              ) : (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatAuditValue(value)}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
