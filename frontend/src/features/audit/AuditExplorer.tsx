import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  ListFilter,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
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

type AuditSubTab = 'all' | 'security' | 'operations' | 'compliance';

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

// Linear-style Humanized Action Descriptions (clean typography, no loud shouting uppercase badges)
function humanizeAuditEvent(eventType: string): { action: string; isDestructive: boolean } {
  const isDestructive =
    eventType.includes('DELETE') ||
    eventType.includes('REVOKE') ||
    eventType.includes('DISABLED');

  switch (eventType) {
    case 'MEMBER_ROLE_CHANGED':
      return { action: 'Changed member role', isDestructive: false };
    case 'MEMBER_INVITED':
      return { action: 'Invited new workspace member', isDestructive: false };
    case 'TENANT_MODULE_ENABLED':
      return { action: 'Enabled workspace module', isDestructive: false };
    case 'TENANT_MODULE_DISABLED':
      return { action: 'Disabled workspace module', isDestructive: true };
    case 'CUSTOMER_UPDATED':
      return { action: 'Updated customer account', isDestructive: false };
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
  'FINANCE_SETTINGS_UPDATED',
  'CUSTOMER_UPDATED',
  'CUSTOM_FIELD_CREATED',
  'CRM_LEAD_CREATED',
  'CRM_LEAD_STAGE_CHANGED',
  'CRM_LEAD_ACTIVITY_ADDED',
  'CSV_DATA_EXPORTED'
];

const COMMON_SUBJECT_TYPES = [
  'module',
  'membership',
  'invitation',
  'purchase_order',
  'purchase_requisition',
  'quality_lot',
  'customer',
  'tenant_finance_settings',
  'custom_field',
  'lead',
  'import_export',
  'item',
  'tenant'
];

export function AuditExplorer({ notify, role }: AuditExplorerProps) {
  // Navigation & Sub-Tabs
  const [activeTab, setActiveTab] = useState<AuditSubTab>('all');
  const [activePill, setActivePill] = useState<string>('ALL');

  // Query Parameters
  const [eventType, setEventType] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [actorId, setActorId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

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

  const makeParams = (includePage: boolean): URLSearchParams => {
    const params = new URLSearchParams();
    if (includePage) {
      params.set('page', String(page));
      params.set('size', '50');
    }
    if (eventType.trim()) params.set('eventType', eventType.trim());
    if (subjectType.trim()) params.set('subjectType', subjectType.trim());
    if (actorId.trim()) params.set('actorId', actorId.trim());
    if (subjectId.trim()) params.set('subjectId', subjectId.trim());
    if (q.trim()) params.set('q', q.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
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

  // Export CSV Action
  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    try {
      const response = await apiFetch(`${API}/audit-events/export?${makeParams(false)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.message || 'Could not export audit events');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `spindl-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Audit log CSV exported successfully');
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
    setActivePill('ALL');
  };

  const changeFilter = (setter: (value: string) => void, value: string): void => {
    setter(value);
    setPage(0);
  };

  const handlePillClick = (pillKey: string, queryHint: string, specificEventType?: string) => {
    setActivePill(pillKey);
    setPage(0);
    if (specificEventType) {
      setEventType(specificEventType);
      setQ('');
    } else {
      setEventType('');
      setQ(queryHint);
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (eventType) count++;
    if (subjectType) count++;
    if (actorId) count++;
    if (subjectId) count++;
    if (q) count++;
    if (from) count++;
    if (to) count++;
    return count;
  }, [eventType, subjectType, actorId, subjectId, q, from, to]);

  const uniqueActorsCount = useMemo(() => {
    const actorNames = new Set(result.items.map((e) => e.actorName).filter(Boolean));
    return Math.max(actorNames.size, 1);
  }, [result.items]);

  const uniqueEventTypesCount = useMemo(() => {
    const types = new Set(result.items.map((e) => e.eventType));
    return Math.max(types.size, 1);
  }, [result.items]);

  const securityEventsCount = useMemo(() => {
    return result.items.filter((e) => {
      const u = e.eventType.toUpperCase();
      return (
        u.startsWith('MEMBER') ||
        u.startsWith('AUTH') ||
        u.startsWith('ROLE') ||
        u.startsWith('TENANT') ||
        u.startsWith('CUSTOM_FIELD')
      );
    }).length;
  }, [result.items]);

  const operationsEventsCount = useMemo(() => {
    return result.items.filter((e) => {
      const u = e.eventType.toUpperCase();
      return (
        u.startsWith('PURCHASE') ||
        u.startsWith('QUALITY') ||
        u.startsWith('ITEM') ||
        u.startsWith('CRM') ||
        u.startsWith('CUSTOMER') ||
        u.startsWith('FINANCE')
      );
    }).length;
  }, [result.items]);

  return (
    <div className="audit-screen-layout">
      {/* 1. Executive Telemetry KPI Strip — Monochrome Linear Architecture */}
      <div className="sales-metric-strip">
        <div className="audit-metric-card">
          <div className="audit-metric-header">
            <span className="audit-metric-label">TOTAL LOGGED EVENTS</span>
            <Activity size={14} className="audit-metric-icon" />
          </div>
          <div className="audit-metric-val">{result.totalElements}</div>
          <div className="audit-metric-sub">
            100% immutable ledger · {uniqueEventTypesCount} event types
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-header">
            <span className="audit-metric-label">AUTHENTICATED ACTORS</span>
            <Users size={14} className="audit-metric-icon" />
          </div>
          <div className="audit-metric-val">
            {uniqueActorsCount} {uniqueActorsCount === 1 ? 'Actor' : 'Actors'}
          </div>
          <div className="audit-metric-sub">
            Attributed identity · cryptographically verified
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-header">
            <span className="audit-metric-label">DATA RETENTION & MASKING</span>
            <ShieldCheck size={14} className="audit-metric-icon" />
          </div>
          <div className="audit-metric-val">SOC 2 / ISO 27001</div>
          <div className="audit-metric-sub">
            Zero cleartext secrets · PII & tokens redacted
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="audit-metric-header">
            <span className="audit-metric-label">EXPORT PRIVILEGES</span>
            <Download size={14} className="audit-metric-icon" />
          </div>
          <div className="audit-metric-val">
            {canExport ? 'Export Privileged' : 'Auditor Access'}
          </div>
          <div className="audit-metric-sub">
            365-day retention window · CSV pipeline
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="audit-subnav-container">
        <div className="audit-subnav-tabs">
          <button
            type="button"
            className={`audit-subnav-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setActivePill('ALL');
              setEventType('');
              setQ('');
            }}
          >
            <ListFilter size={13} />
            <span>All Activity</span>
            <span className="audit-subnav-badge">{result.totalElements}</span>
          </button>

          <button
            type="button"
            className={`audit-subnav-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('security');
              setActivePill('ALL_SECURITY');
              setEventType('');
              setQ('MEMBER');
            }}
          >
            <Shield size={13} />
            <span>Security & Access</span>
            <span className="audit-subnav-badge">{securityEventsCount}</span>
          </button>

          <button
            type="button"
            className={`audit-subnav-tab ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('operations');
              setActivePill('ALL_OPERATIONS');
              setEventType('');
              setQ('QUALITY');
            }}
          >
            <Layers size={13} />
            <span>Commercial & Ops</span>
            <span className="audit-subnav-badge">{operationsEventsCount}</span>
          </button>

          <button
            type="button"
            className={`audit-subnav-tab ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            <FileSpreadsheet size={13} />
            <span>Compliance & Export</span>
            <span className="audit-subnav-badge">SOC 2</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="mini-action"
            onClick={() => setRefreshIndex((prev) => prev + 1)}
            title="Refresh audit event stream"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          {canExport && (
            <button
              type="button"
              className="button button-secondary"
              disabled={exporting}
              onClick={exportCsv}
              style={{ height: '30px', fontSize: '12px' }}
            >
              <Download size={13} />
              <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* View Branch: Tab 4 Compliance & Export Hub */}
      {activeTab === 'compliance' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Card 1: Direct CSV Export Station */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <Download size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Audit Trail Export Station</span>
                </h4>
                <span className="audit-tag">CSV Ready</span>
              </div>
              <p>
                Export immutable system events for external compliance audits, forensic inspection, or log archiving.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div className="audit-filter-field">
                  <label>From Date</label>
                  <input type="date" value={from} onChange={(e) => changeFilter(setFrom, e.target.value)} />
                </div>
                <div className="audit-filter-field">
                  <label>To Date</label>
                  <input type="date" value={to} onChange={(e) => changeFilter(setTo, e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Privilege Tier: <b style={{ color: 'var(--sp-text)' }}>{role || 'Standard'}</b>
                </span>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!canExport || exporting}
                  onClick={exportCsv}
                  style={{ height: '30px', fontSize: '12px' }}
                >
                  <Download size={13} />
                  <span>{exporting ? 'Generating…' : 'Download CSV'}</span>
                </button>
              </div>
            </div>

            {/* Card 2: Cryptographic Masking Safeguards */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <Lock size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Data Sanitization & Redaction</span>
                </h4>
                <span className="audit-tag">Enforced</span>
              </div>
              <p>
                Deterministic filters run before persistence to guarantee that sensitive credentials never enter storage:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Tokens & Secrets:</b> Passwords, API keys, and bearer tokens are replaced with <code>[REDACTED]</code>.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Email Masking:</b> Actor email local-parts are masked (e.g. <code>t***@domain.com</code>).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--sp-brand)' }} />
                  <span><b>Immutability:</b> Write-once append-only storage protocol prevents historical tampering.</span>
                </div>
              </div>
            </div>

            {/* Card 3: Regulatory Alignment */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <ShieldCheck size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Regulatory Standards Alignment</span>
                </h4>
                <span className="audit-tag">Verified</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>SOC 2 Type II (CC6.1 - CC6.3):</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Access privilege alterations, authorization grants, and identity transitions tracked with millisecond resolution.
                  </div>
                </div>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>ISO/IEC 27001:2022 (Control A.12.4):</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Tamper-resistant audit recording and logging facilities protected against unauthorized modification.
                  </div>
                </div>
                <div>
                  <b style={{ color: 'var(--sp-text)' }}>GDPR Article 30:</b>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    Immutable register of data processing activities and customer entity mutation history.
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Retention Policy */}
            <div className="audit-compliance-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>
                  <Clock size={14} style={{ color: 'var(--sp-text-secondary)' }} />
                  <span>Storage & Retention Policy</span>
                </h4>
                <span className="audit-tag">365 Days</span>
              </div>
              <p>
                Audit trails are retained for a rolling 12-month period in compliance with standard corporate compliance mandates.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
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
        /* View Branch: Tabs 1, 2, 3 (Audit Register & Event Feed) */
        <>
          {/* 3. Linear Toolbar: Search + Monochrome Segmented Category Controls */}
          <div className="audit-toolbar">
            <div className="audit-toolbar-left">
              <div className="audit-search-field">
                <Search size={14} style={{ color: 'var(--sp-text-muted)' }} />
                <input
                  className="audit-search-input"
                  placeholder={
                    activeTab === 'security'
                      ? 'Filter security, roles, modules…'
                      : activeTab === 'operations'
                      ? 'Filter purchases, quality, items…'
                      : 'Filter events by actor, action, subject…'
                  }
                  value={q}
                  onChange={(e) => changeFilter(setQ, e.target.value)}
                />
                {q ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => changeFilter(setQ, '')}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="sales-search-shortcut">/</span>
                )}
              </div>

              {/* Linear Segmented Category Group */}
              <div className="audit-category-group">
                {activeTab === 'all' && (
                  <>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'ALL' ? 'active' : ''}`}
                      onClick={() => handlePillClick('ALL', '')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'TENANT' ? 'active' : ''}`}
                      onClick={() => handlePillClick('TENANT', 'TENANT')}
                    >
                      Tenant
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'MEMBER' ? 'active' : ''}`}
                      onClick={() => handlePillClick('MEMBER', 'MEMBER')}
                    >
                      Access
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'PURCHASE' ? 'active' : ''}`}
                      onClick={() => handlePillClick('PURCHASE', 'PURCHASE')}
                    >
                      Purchases
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'QUALITY' ? 'active' : ''}`}
                      onClick={() => handlePillClick('QUALITY', 'QUALITY')}
                    >
                      Quality
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'CRM' ? 'active' : ''}`}
                      onClick={() => handlePillClick('CRM', 'CRM')}
                    >
                      CRM
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'EXPORTS' ? 'active' : ''}`}
                      onClick={() => handlePillClick('EXPORTS', 'EXPORT')}
                    >
                      Exports
                    </button>
                  </>
                )}

                {activeTab === 'security' && (
                  <>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'ALL_SECURITY' ? 'active' : ''}`}
                      onClick={() => handlePillClick('ALL_SECURITY', 'MEMBER')}
                    >
                      All Security
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'MODULES' ? 'active' : ''}`}
                      onClick={() => handlePillClick('MODULES', 'MODULE')}
                    >
                      Modules
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'ROLES' ? 'active' : ''}`}
                      onClick={() => handlePillClick('ROLES', 'ROLE')}
                    >
                      Roles
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'INVITES' ? 'active' : ''}`}
                      onClick={() => handlePillClick('INVITES', 'INVITED')}
                    >
                      Invites
                    </button>
                  </>
                )}

                {activeTab === 'operations' && (
                  <>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'ALL_OPERATIONS' ? 'active' : ''}`}
                      onClick={() => handlePillClick('ALL_OPERATIONS', '')}
                    >
                      All Ops
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'OPS_PURCHASING' ? 'active' : ''}`}
                      onClick={() => handlePillClick('OPS_PURCHASING', 'PURCHASE')}
                    >
                      Purchases
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'OPS_QUALITY' ? 'active' : ''}`}
                      onClick={() => handlePillClick('OPS_QUALITY', 'QUALITY')}
                    >
                      Quality
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'OPS_CRM' ? 'active' : ''}`}
                      onClick={() => handlePillClick('OPS_CRM', 'CRM')}
                    >
                      CRM
                    </button>
                    <button
                      type="button"
                      className={`audit-category-btn ${activePill === 'OPS_FINANCE' ? 'active' : ''}`}
                      onClick={() => handlePillClick('OPS_FINANCE', 'FINANCE')}
                    >
                      Finance
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              className={`mini-action ${showAdvancedFilters || activeFiltersCount > 0 ? 'active' : ''}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter size={13} />
              <span>Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>
          </div>

          {/* 4. Collapsible Advanced Filters Drawer */}
          {showAdvancedFilters && (
            <div className="audit-filter-drawer">
              <div className="audit-filter-field">
                <label>Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => changeFilter(setEventType, e.target.value)}
                >
                  <option value="">All Types</option>
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
                  <option value="">All Subjects</option>
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
                  onChange={(e) => changeFilter(setFrom, e.target.value)}
                />
              </div>

              <div className="audit-filter-field">
                <label>To Date</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => changeFilter(setTo, e.target.value)}
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
                  placeholder="Subject UUID"
                  value={subjectId}
                  onChange={(e) => changeFilter(setSubjectId, e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={resetFilters}
                  style={{ height: '30px', fontSize: '12px' }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* 5. Linear Event Ledger Table */}
          <div className="audit-table-panel">
            <div className="table-scroll" style={{ margin: 0 }}>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>TIME</th>
                    <th style={{ width: '220px' }}>ACTOR</th>
                    <th style={{ width: '320px' }}>ACTION</th>
                    <th style={{ width: '240px' }}>TARGET ENTITY</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>DETAILS</th>
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
                            className="button button-secondary"
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
                              {isDestructive ? (
                                <span className="audit-tag danger">Disabled</span>
                              ) : (
                                <span className="audit-tag">
                                  {formatAuditLabel(event.subjectType)}
                                </span>
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
                              className="audit-row-action"
                              onClick={() => setSelectedEvent(event)}
                              title="Inspect event details"
                            >
                              <Eye size={12} />
                              <span>Inspect</span>
                              {detailCount > 0 && (
                                <span style={{ opacity: 0.6, fontSize: '10.5px' }}>({detailCount})</span>
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

            {/* 6. Linear High-Density Pagination Bar */}
            <div className="movement-pagination" style={{ margin: 0, padding: '8px 14px', borderTop: '1px solid var(--sp-border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                Showing {result.totalElements ? page * 50 + 1 : 0}–
                {Math.min((page + 1) * 50, result.totalElements)} of {result.totalElements} events
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="mini-action muted"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  style={{ height: '26px' }}
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)', padding: '0 4px' }}>
                  Page {result.totalPages ? page + 1 : 0} of {result.totalPages}
                </span>
                <button
                  type="button"
                  className="mini-action muted"
                  disabled={!result.totalPages || page >= result.totalPages - 1 || loading}
                  onClick={() => setPage((current) => current + 1)}
                  style={{ height: '26px' }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 7. Event Details Inspector Modal — Authentic Linear Dialog */}
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
