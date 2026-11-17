import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GitMerge,
  HelpCircle,
  IndianRupee,
  Layers,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { CustomerRecord, CustomerTimelineEvent } from '../../types/customer';
import { CustomFieldEditor } from './CustomFieldEditor';

export interface CustomerDirectoryProps {
  title: string;
  subtitle: string;
  query: string;
  setQuery: (query: string) => void;
  data: CustomerRecord[];
  customers: CustomerRecord[];
  role?: string;
  onMerged: () => Promise<void>;
  notify: (message: string) => void;
  onNewCustomer?: () => void;
  onRefresh?: () => Promise<void>;
}

type CustomerSubTab = 'accounts' | 'timeline' | 'governance';
type QuickFilterPill = 'ALL' | 'ACTIVE' | 'KEY' | 'HOLD';

function parseAmount(val: string | number | null | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.detail === 'string' ? value.detail : typeof value.message === 'string' ? value.message : undefined;
}

function isCustomerTimelineEvent(value: unknown): value is CustomerTimelineEvent {
  return (
    isRecord(value) &&
    typeof value.occurredAt === 'string' &&
    typeof value.eventType === 'string' &&
    typeof value.reference === 'string' &&
    typeof value.status === 'string' &&
    (value.amount === null || typeof value.amount === 'number' || typeof value.amount === 'string')
  );
}

/* Linear Customer Merge Dialog Modal */
interface CustomerMergeModalProps {
  sourceCustomer: CustomerRecord;
  customers: CustomerRecord[];
  onClose: () => void;
  onMerged: () => Promise<void>;
  notify: (msg: string) => void;
}

function CustomerMergeModal({
  sourceCustomer,
  customers,
  onClose,
  onMerged,
  notify
}: CustomerMergeModalProps) {
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const availableTargets = customers.filter((c) => c.id !== sourceCustomer.id);
  const targetCustomer = availableTargets.find((c) => c.id === targetId);

  const handleMerge = async () => {
    if (!targetCustomer) return;
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/customers/${sourceCustomer.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCustomerId: targetCustomer.id })
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body) ?? 'Could not merge customer accounts');
      await onMerged();
      notify(`Customer ${sourceCustomer.name} merged into ${targetCustomer.name}`);
      onClose();
    } catch (error) {
      notify(messageFrom(error, 'Could not merge customer accounts'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="record-modal" style={{ width: 'min(520px, 95vw)' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitMerge size={16} />
            </div>
            <div>
              <h2>Merge Customer Account</h2>
              <p>Consolidate duplicate records and move transaction history.</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        {/* Source Customer Preview */}
        <div style={{ padding: '12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Source Account (Will be deactivated & merged)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{sourceCustomer.name}</strong>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
                <span className="sales-ref-badge" style={{ marginRight: '6px' }}>{sourceCustomer.code}</span>
                {sourceCustomer.email}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                {sourceCustomer.orders} orders
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Outstanding: {sourceCustomer.outstanding}
              </div>
            </div>
          </div>
        </div>

        {/* Target Customer Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Select Surviving Target Account
          </label>
          <select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setConfirmed(false);
            }}
            disabled={saving}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid var(--sp-border)',
              background: 'var(--sp-surface)',
              color: 'var(--sp-text)',
              fontSize: '13px'
            }}
          >
            <option value="">-- Choose destination customer --</option>
            {availableTargets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code}) · {c.orders} orders
              </option>
            ))}
          </select>
        </div>

        {/* Warning Callout */}
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: '10px' }}>
          <AlertOctagon size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '11.5px', color: '#991b1b', lineHeight: '1.45' }}>
            <strong>Irreversible consolidation:</strong> All quotations, sales orders, invoices, payments, credit returns, attachments, and custom fields from <strong>{sourceCustomer.name}</strong> will be moved into <strong>{targetCustomer ? targetCustomer.name : 'the selected target'}</strong>. The source account will be archived and cannot be restored.
          </div>
        </div>

        {/* Confirmation Checkbox */}
        {targetCustomer && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--sp-text)' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={saving}
              style={{ width: 14, height: 14 }}
            />
            <span>I understand that this action is permanent and merges all transaction ledgers.</span>
          </label>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            className="button button-secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!targetId || !confirmed || saving}
            onClick={() => void handleMerge()}
            style={{ background: '#dc2626', borderColor: '#b91c1c' }}
          >
            {saving ? 'Merging records…' : 'Confirm & Merge Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Quick Timeline Drawer Modal */
interface QuickTimelineDrawerProps {
  customer: CustomerRecord;
  onClose: () => void;
  onViewAllTimeline?: () => void;
}

function QuickTimelineDrawer({ customer, onClose, onViewAllTimeline }: QuickTimelineDrawerProps) {
  const [events, setEvents] = useState<CustomerTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    apiFetch(`${API}/customers/${customer.id}/timeline`)
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(apiError(body) ?? 'Could not load customer timeline');
        }
        if (!Array.isArray(body) || !body.every(isCustomerTimelineEvent)) {
          throw new Error('Invalid activity format returned from backend');
        }
        if (current) setEvents(body);
      })
      .catch((reason: unknown) => {
        if (current) setError(messageFrom(reason, 'Could not load timeline'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [customer.id]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="record-modal" style={{ width: 'min(580px, 95vw)', maxHeight: '85vh' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
            <div>
              <h2>{customer.name} Activity</h2>
              <p>Commercial timeline across quotes, orders, invoices, and payments.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        {/* Customer Mini Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
          <div>
            <span className="sales-ref-badge">{customer.code}</span>
            <span style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', marginLeft: '8px' }}>{customer.email}</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Outstanding: {customer.outstanding}
          </div>
        </div>

        {/* Timeline Stream */}
        <div style={{ overflowY: 'auto', padding: '4px 8px 12px', maxHeight: '420px' }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
              <Clock size={24} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px' }} />
              <div>Fetching transaction history…</div>
            </div>
          ) : error ? (
            <div style={{ padding: '20px', color: '#dc2626', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', fontSize: '12px' }}>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
              <ShoppingBag size={28} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>No recorded transactions yet</div>
              <div style={{ fontSize: '12px' }}>Create quotes or sales orders to see customer events.</div>
            </div>
          ) : (
            <div className="customer-timeline-feed">
              {events.map((ev, idx) => {
                const typeClass = ev.eventType.toLowerCase();
                const formattedDate = new Date(ev.occurredAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={`${ev.eventType}-${ev.reference}-${idx}`} className="customer-timeline-entry">
                    <div className={`customer-timeline-node ${typeClass}`} />
                    <div className="customer-timeline-card">
                      <div className="customer-timeline-topline">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`customer-event-pill ${typeClass}`}>
                            {ev.eventType.replace('_', ' ')}
                          </span>
                          <span className="sales-ref-badge">{ev.reference}</span>
                        </div>
                        {ev.amount != null && (
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(ev.amount)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
                        <span>Status: <strong style={{ textTransform: 'capitalize' }}>{ev.status}</strong></span>
                        <time dateTime={ev.occurredAt}>{formattedDate}</time>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {onViewAllTimeline ? (
            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => {
                onClose();
                onViewAllTimeline();
              }}
            >
              Open in Timeline Register <ChevronRight size={13} />
            </button>
          ) : <div />}
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* Edit Customer Terms & Governance Modal */
interface EditCustomerTermsModalProps {
  customer: CustomerRecord;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  notify: (msg: string) => void;
}

function EditCustomerTermsModal({
  customer,
  onClose,
  onRefresh,
  notify
}: EditCustomerTermsModalProps) {
  const [termsDays, setTermsDays] = useState(customer.paymentTermsDays ?? 30);
  const [creditLimit, setCreditLimit] = useState(customer.creditLimit ? String(customer.creditLimit) : '0');
  const [creditHold, setCreditHold] = useState(customer.creditHold ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: customer.name,
        email: customer.email,
        status: customer.status || 'Active',
        active: true,
        customerType: customer.customerType || 'COMPANY',
        contactName: customer.contactName || '',
        phone: customer.phone || '',
        addressLine1: customer.addressLine1 || '',
        addressLine2: customer.addressLine2 || '',
        city: customer.city || '',
        region: customer.region || '',
        postalCode: customer.postalCode || '',
        countryCode: customer.countryCode || 'IN',
        taxId: customer.taxId || '',
        paymentTermsDays: Number(termsDays),
        creditLimit: parseFloat(creditLimit) || 0,
        tags: customer.tags || '',
        creditHold: creditHold
      };

      const res = await apiFetch(`${API}/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to update credit terms');
      if (onRefresh) await onRefresh();
      notify(`Credit terms updated for ${customer.name}`);
      onClose();
    } catch (err) {
      notify(messageFrom(err, 'Could not save customer terms'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="record-modal" onSubmit={handleSave} style={{ width: 'min(480px, 95vw)' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2>Edit Credit & Payment Terms</h2>
              <p>{customer.name} ({customer.code})</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
              Payment Terms (Days)
            </label>
            <input
              type="number"
              min="0"
              max="365"
              value={termsDays}
              onChange={(e) => setTermsDays(Number(e.target.value))}
              required
              disabled={saving}
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>0 = Due on receipt, 15 = Net 15d, 30 = Net 30d</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
              Approved Credit Limit (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              required
              disabled={saving}
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Current outstanding exposure: {customer.outstanding}</span>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--sp-surface-hover)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--sp-text)' }}>
              <input
                type="checkbox"
                checked={creditHold}
                onChange={(e) => setCreditHold(e.target.checked)}
                disabled={saving}
                style={{ width: 15, height: 15 }}
              />
              <span style={{ fontWeight: 600, color: creditHold ? '#dc2626' : 'var(--sp-text)' }}>
                Place account on Credit Hold
              </span>
            </label>
            <p style={{ fontSize: '11px', color: 'var(--sp-text-muted)', margin: '4px 0 0 23px' }}>
              Prevents dispatch of sales orders and new quotation issuance until released.
            </p>
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Credit Terms'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CustomerDirectory({
  title,
  subtitle,
  query,
  setQuery,
  data,
  customers,
  role,
  onMerged,
  notify,
  onNewCustomer,
  onRefresh
}: CustomerDirectoryProps) {
  const [activeTab, setActiveTab] = useState<CustomerSubTab>('accounts');
  const [quickPill, setQuickPill] = useState<QuickFilterPill>('ALL');
  const [mergingCustomer, setMergingCustomer] = useState<CustomerRecord | null>(null);
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerRecord | null>(null);
  const [editingTermsCustomer, setEditingTermsCustomer] = useState<CustomerRecord | null>(null);

  // Dedicated Timeline tab customer selection
  const [selectedTimelineCustomerId, setSelectedTimelineCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [timelineEvents, setTimelineEvents] = useState<CustomerTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');

  // Sync selected customer if empty
  useEffect(() => {
    if (!selectedTimelineCustomerId && customers.length > 0) {
      setSelectedTimelineCustomerId(customers[0].id);
    }
  }, [customers, selectedTimelineCustomerId]);

  // Load timeline for selected customer when in 'timeline' tab
  useEffect(() => {
    if (activeTab !== 'timeline' || !selectedTimelineCustomerId) return;
    let current = true;
    setTimelineLoading(true);
    setTimelineError('');
    apiFetch(`${API}/customers/${selectedTimelineCustomerId}/timeline`)
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(apiError(body) ?? 'Could not load customer timeline');
        }
        if (!Array.isArray(body) || !body.every(isCustomerTimelineEvent)) {
          throw new Error('Invalid timeline format');
        }
        if (current) setTimelineEvents(body);
      })
      .catch((err: unknown) => {
        if (current) setTimelineError(messageFrom(err, 'Failed to load timeline'));
      })
      .finally(() => {
        if (current) setTimelineLoading(false);
      });
    return () => {
      current = false;
    };
  }, [activeTab, selectedTimelineCustomerId]);

  // Executive KPI calculations across all customers
  const { totalOutstanding, totalOrders, activeCount, inactiveCount, holdCount, goodStandingPct } =
    useMemo(() => {
      let sumOutstanding = 0;
      let sumOrders = 0;
      let active = 0;
      let inactive = 0;
      let hold = 0;

      for (const c of customers) {
        sumOutstanding += parseAmount(c.outstanding);
        sumOrders += c.orders || 0;
        if (c.status?.toLowerCase() === 'active') active++;
        else inactive++;
        if (c.creditHold) hold++;
      }

      const total = customers.length;
      const goodStandingPct = total > 0 ? Math.round(((total - hold) / total) * 100) : 100;

      return {
        totalOutstanding: sumOutstanding,
        totalOrders: sumOrders,
        activeCount: active,
        inactiveCount: inactive,
        holdCount: hold,
        goodStandingPct
      };
    }, [customers]);

  // Quick filter pills for Tab 1
  const filteredAccounts = useMemo(() => {
    return data.filter((c) => {
      if (quickPill === 'ACTIVE') return c.status?.toLowerCase() === 'active';
      if (quickPill === 'HOLD') return c.creditHold;
      if (quickPill === 'KEY') return (c.tags || '').toLowerCase().includes('key') || (c.orders || 0) > 0;
      return true;
    });
  }, [data, quickPill]);

  // CSV Export
  const exportDirectoryCSV = () => {
    const headers = [
      'Customer Code',
      'Company Name',
      'Contact Person',
      'Email',
      'Phone',
      'City',
      'Region',
      'Country',
      'Tax ID / GSTIN',
      'Payment Terms (Days)',
      'Credit Limit (₹)',
      'Orders Placed',
      'Outstanding Balance',
      'Status',
      'Credit Hold',
      'Tags'
    ];

    const rows = filteredAccounts.map((c) => [
      `"${c.code}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.contactName || '').replace(/"/g, '""')}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.city || ''}"`,
      `"${c.region || ''}"`,
      `"${c.countryCode || 'IN'}"`,
      `"${c.taxId || ''}"`,
      c.paymentTermsDays ?? 0,
      c.creditLimit ? parseAmount(c.creditLimit) : 0,
      c.orders || 0,
      `"${c.outstanding}"`,
      `"${c.status}"`,
      c.creditHold ? 'YES' : 'NO',
      `"${(c.tags || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customer_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${filteredAccounts.length} customer records to CSV`);
  };

  // Toggle credit hold directly
  const toggleCreditHold = async (customer: CustomerRecord) => {
    const nextHold = !customer.creditHold;
    try {
      const payload = {
        name: customer.name,
        email: customer.email,
        status: customer.status || 'Active',
        active: true,
        customerType: customer.customerType || 'COMPANY',
        contactName: customer.contactName || '',
        phone: customer.phone || '',
        addressLine1: customer.addressLine1 || '',
        addressLine2: customer.addressLine2 || '',
        city: customer.city || '',
        region: customer.region || '',
        postalCode: customer.postalCode || '',
        countryCode: customer.countryCode || 'IN',
        taxId: customer.taxId || '',
        paymentTermsDays: customer.paymentTermsDays ?? 0,
        creditLimit: customer.creditLimit ? parseAmount(customer.creditLimit) : 0,
        tags: customer.tags || '',
        creditHold: nextHold
      };

      const res = await apiFetch(`${API}/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to toggle credit hold');
      if (onRefresh) await onRefresh();
      notify(`Customer ${customer.name} ${nextHold ? 'placed on credit hold' : 'released from credit hold'}`);
    } catch (err) {
      notify(messageFrom(err, 'Could not toggle credit hold'));
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedTimelineCustomerId);

  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Commercial KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL ACCOUNTS</span>
            <Users size={16} className="sales-metric-icon trend" />
          </div>
          <div className="sales-metric-val">{customers.length} Accounts</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{activeCount} Active</span> · {inactiveCount} Inactive
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">OPEN RECEIVABLES</span>
            <IndianRupee size={16} className="sales-metric-icon orders" />
          </div>
          <div className="sales-metric-val">{formatCurrency(totalOutstanding)}</div>
          <div className="sales-metric-sub">
            Across commercial customer accounts
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LIFETIME SALES ORDERS</span>
            <ShoppingBag size={16} className="sales-metric-icon invoices" />
          </div>
          <div className="sales-metric-val">{totalOrders} Orders</div>
          <div className="sales-metric-sub">
            Fulfillments & quotes converted
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CREDIT HEALTH & RISK</span>
            {holdCount > 0 ? (
              <ShieldAlert size={16} className="sales-metric-icon credits" style={{ color: '#ef4444' }} />
            ) : (
              <ShieldCheck size={16} className="sales-metric-icon credits" style={{ color: '#10b981' }} />
            )}
          </div>
          <div className="sales-metric-val">
            {holdCount} on Hold
          </div>
          <div className="sales-metric-sub">
            <span className={holdCount > 0 ? 'sales-sub-warning' : 'sales-sub-highlight'}>
              {goodStandingPct}%
            </span> in good credit standing
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <Users size={14} />
            <span>Customer Accounts</span>
            <span className="sales-subnav-badge">{customers.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Activity size={14} />
            <span>Activity & Timelines</span>
            <span className="sales-subnav-badge">Live feed</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'governance' ? 'active' : ''}`}
            onClick={() => setActiveTab('governance')}
          >
            <ShieldCheck size={14} />
            <span>Credit Terms & Governance</span>
            {holdCount > 0 && <span className="sales-subnav-badge" style={{ color: '#dc2626' }}>{holdCount} hold</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={exportDirectoryCSV}
            title="Export filtered customer directory to CSV"
          >
            <Download size={13} />
            <span>Export Directory CSV</span>
          </button>

          {onNewCustomer && (
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={onNewCustomer}
            >
              <Plus size={13} />
              <span>New customer</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SUB-TAB 1: Customer Accounts Register */}
      {activeTab === 'accounts' && (
        <>
          <div className="sales-toolbar">
            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Search customers, contacts, GSTIN or tags..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="sales-search-kbd">/</kbd>
            </div>

            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'ALL' ? 'active' : ''}`}
                onClick={() => setQuickPill('ALL')}
              >
                All <span className="sales-pill-count">{customers.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setQuickPill('ACTIVE')}
              >
                Active <span className="sales-pill-count">{activeCount}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'KEY' ? 'active' : ''}`}
                onClick={() => setQuickPill('KEY')}
              >
                Key Accounts
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${quickPill === 'HOLD' ? 'active' : ''}`}
                onClick={() => setQuickPill('HOLD')}
              >
                Credit Hold {holdCount > 0 && <span className="sales-pill-count" style={{ color: '#dc2626' }}>{holdCount}</span>}
              </button>
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>CUSTOMER & CONTACT</th>
                    <th style={{ width: '110px' }}>CODE</th>
                    <th style={{ minWidth: '130px' }}>TERMS & LIMIT</th>
                    <th style={{ width: '90px' }}>ORDERS</th>
                    <th style={{ minWidth: '120px' }}>OUTSTANDING</th>
                    <th style={{ width: '120px' }}>STATUS</th>
                    <th style={{ minWidth: '200px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Users size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No customer accounts found</div>
                          <div className="sales-empty-desc">
                            {query ? 'No records match your search query.' : 'Create your first customer to begin quoting and invoicing.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((customer) => {
                      const outstandingNum = parseAmount(customer.outstanding);

                      return (
                        <tr key={customer.id} className="sales-row">
                          {/* Customer & Contact */}
                          <td>
                            <div className="sales-customer-cell">
                              <span className={`sales-customer-avatar ${customer.tone || 'lavender'}`}>
                                {customer.initials}
                              </span>
                              <div className="customer-info-cell">
                                <strong>{customer.name}</strong>
                                <small>
                                  {[customer.contactName, customer.phone, customer.email, customer.city].filter(Boolean).join(' · ')}
                                </small>
                                {customer.tags && (
                                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                                    {customer.tags.split(',').map((tag) => (
                                      <span key={tag} className="customer-tag-pill">
                                        {tag.trim()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Customer Code */}
                          <td>
                            <span className="sales-ref-badge">{customer.code}</span>
                          </td>

                          {/* Terms & Limit */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
                                Net {customer.paymentTermsDays ?? 30}d
                              </span>
                              <small style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                Limit: {customer.creditLimit ? formatCurrency(customer.creditLimit) : '₹ 0'}
                              </small>
                            </div>
                          </td>

                          {/* Orders */}
                          <td>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {customer.orders || 0}
                            </span>
                          </td>

                          {/* Outstanding */}
                          <td>
                            <div className={`sales-amount-cell ${outstandingNum > 0 ? 'outstanding' : 'settled'}`}>
                              {customer.outstanding}
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <Status label={customer.status} />
                              {customer.creditHold && (
                                <span className="customer-risk-chip hold" title="Credit hold active">
                                  <AlertTriangle size={10} /> On Hold
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <div className="sales-actions-cell" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                              <CustomFieldEditor resource="customers" recordId={customer.id} />
                              
                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                onClick={() => setDrawerCustomer(customer)}
                                title="View transaction timeline"
                              >
                                <Clock size={12} />
                                <span>Activity</span>
                              </button>

                              {['OWNER', 'ADMIN'].includes(role ?? '') && customers.length >= 2 && (
                                <button
                                  type="button"
                                  className="sales-action-btn secondary"
                                  onClick={() => setMergingCustomer(customer)}
                                  title="Merge duplicate customer into another account"
                                >
                                  <GitMerge size={12} />
                                  <span>Merge</span>
                                </button>
                              )}
                            </div>
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

      {/* 4. SUB-TAB 2: Activity & Timelines Register */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '16px' }}>
          {/* Customer Selector Sidebar */}
          <div className="sales-table-card" style={{ padding: '14px', height: 'fit-content' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Select Customer Account
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '480px', overflowY: 'auto' }}>
              {customers.map((c) => {
                const isSelected = c.id === selectedTimelineCustomerId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedTimelineCustomerId(c.id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--sp-brand)' : 'var(--sp-border)',
                      background: isSelected ? 'var(--sp-brand-soft)' : 'var(--sp-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12.5px', color: isSelected ? 'var(--sp-brand)' : 'var(--sp-text)' }}>
                        {c.name}
                      </strong>
                      <span className="sales-ref-badge" style={{ fontSize: '10px' }}>{c.code}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                      <span>{c.orders} orders</span>
                      <span>{c.outstanding}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Stream View */}
          <div className="sales-table-card" style={{ padding: '16px 20px' }}>
            {selectedCustomer && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid var(--sp-border)', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                      {selectedCustomer.name}
                    </h3>
                    <span className="sales-ref-badge">{selectedCustomer.code}</span>
                    {selectedCustomer.creditHold && (
                      <span className="customer-risk-chip hold">
                        <AlertTriangle size={11} /> Credit Hold
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '4px 0 0' }}>
                    {[selectedCustomer.contactName, selectedCustomer.phone, selectedCustomer.email, selectedCustomer.city].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Outstanding: {selectedCustomer.outstanding}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px' }}>
                    Terms: Net {selectedCustomer.paymentTermsDays ?? 30}d
                  </div>
                </div>
              </div>
            )}

            {timelineLoading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
                <Clock size={28} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px' }} />
                <div>Loading customer activity stream…</div>
              </div>
            ) : timelineError ? (
              <div style={{ padding: '20px', color: '#dc2626', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px' }}>
                {timelineError}
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="sales-empty-state" style={{ padding: '60px 20px' }}>
                <ShoppingBag size={36} className="sales-empty-icon" />
                <div className="sales-empty-title">No transactions recorded yet</div>
                <div className="sales-empty-desc">
                  This account has no quotes, sales orders, invoices, payments, or credit returns on file.
                </div>
              </div>
            ) : (
              <div className="customer-timeline-feed">
                {timelineEvents.map((ev, idx) => {
                  const typeClass = ev.eventType.toLowerCase();
                  const formattedDate = new Date(ev.occurredAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={`${ev.eventType}-${ev.reference}-${idx}`} className="customer-timeline-entry">
                      <div className={`customer-timeline-node ${typeClass}`} />
                      <div className="customer-timeline-card">
                        <div className="customer-timeline-topline">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`customer-event-pill ${typeClass}`}>
                              {ev.eventType.replace('_', ' ')}
                            </span>
                            <span className="sales-ref-badge">{ev.reference}</span>
                            <span className="sales-status-chip completed" style={{ textTransform: 'capitalize' }}>
                              {ev.status}
                            </span>
                          </div>
                          {ev.amount != null && (
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(ev.amount)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '4px' }}>
                          <span>Event reference: <code>{ev.reference}</code></span>
                          <time dateTime={ev.occurredAt}>{formattedDate}</time>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: Credit Terms & Governance Register */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Credit Overview Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">TOTAL COMMERCIAL EXPOSURE</span>
                <IndianRupee size={15} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
                {formatCurrency(totalOutstanding)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Across {customers.length} business accounts
              </div>
            </div>

            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">CREDIT RISK STANDING</span>
                {holdCount > 0 ? <AlertTriangle size={15} color="#ef4444" /> : <ShieldCheck size={15} color="#10b981" />}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: holdCount > 0 ? '#dc2626' : 'var(--sp-text)', margin: '4px 0 2px' }}>
                {holdCount} Accounts on Hold
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {goodStandingPct}% of ledger in good compliance
              </div>
            </div>

            <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sales-metric-label">STANDARD SETTLEMENT TERMS</span>
                <Calendar size={15} color="#0284c7" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--sp-text)', margin: '4px 0 2px' }}>
                Net 15d – Net 45d
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                ERP invoice payment schedule
              </div>
            </div>
          </div>

          {/* Governance High Density Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '200px' }}>CUSTOMER</th>
                    <th style={{ width: '100px' }}>CODE</th>
                    <th style={{ minWidth: '120px' }}>TAX ID / GSTIN</th>
                    <th style={{ width: '100px' }}>TERMS</th>
                    <th style={{ minWidth: '120px' }}>CREDIT LIMIT</th>
                    <th style={{ minWidth: '120px' }}>OUTSTANDING</th>
                    <th style={{ minWidth: '140px' }}>UTILIZATION</th>
                    <th style={{ width: '120px' }}>CREDIT STATUS</th>
                    <th style={{ minWidth: '160px', textAlign: 'right' }}>GOVERNANCE ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const limit = parseAmount(c.creditLimit);
                    const outstanding = parseAmount(c.outstanding);
                    const utilization = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;
                    const isOverLimit = limit > 0 && outstanding > limit;

                    return (
                      <tr key={c.id} className="sales-row">
                        <td>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                            {c.city ? `${c.city}, ${c.countryCode || 'IN'}` : c.customerType || 'Company'}
                          </div>
                        </td>

                        <td>
                          <span className="sales-ref-badge">{c.code}</span>
                        </td>

                        <td>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--sp-font-mono, monospace)', color: 'var(--sp-text)' }}>
                            {c.taxId || '—'}
                          </span>
                        </td>

                        <td>
                          <span className="sales-warehouse-pill">
                            Net {c.paymentTermsDays ?? 30}d
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                            {limit > 0 ? formatCurrency(limit) : 'No limit'}
                          </span>
                        </td>

                        <td>
                          <span className={`sales-amount-cell ${outstanding > 0 ? 'outstanding' : 'settled'}`}>
                            {c.outstanding}
                          </span>
                        </td>

                        {/* Utilization Bar */}
                        <td>
                          <div style={{ width: '110px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--sp-text-muted)', marginBottom: '2px' }}>
                              <span>{utilization}%</span>
                              {isOverLimit && <span style={{ color: '#dc2626', fontWeight: 600 }}>Breached</span>}
                            </div>
                            <div className="customer-progress-track">
                              <div
                                className={`customer-progress-bar ${isOverLimit ? 'danger' : utilization > 75 ? 'warning' : ''}`}
                                style={{ width: `${utilization}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Credit Status */}
                        <td>
                          {c.creditHold ? (
                            <span className="customer-risk-chip hold">
                              <AlertTriangle size={10} /> Credit Hold
                            </span>
                          ) : (
                            <span className="customer-risk-chip good">
                              <CheckCircle2 size={10} /> Approved
                            </span>
                          )}
                        </td>

                        {/* Governance Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="sales-actions-cell" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              onClick={() => setEditingTermsCustomer(c)}
                              title="Edit payment terms and credit limit"
                            >
                              Edit Terms
                            </button>

                            <button
                              type="button"
                              className={`sales-action-btn ${c.creditHold ? 'primary' : 'secondary'}`}
                              onClick={() => void toggleCreditHold(c)}
                              title={c.creditHold ? 'Release credit hold' : 'Place account on credit hold'}
                              style={c.creditHold ? { background: '#10b981', borderColor: '#059669', color: '#fff' } : {}}
                            >
                              {c.creditHold ? 'Release' : 'Hold'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. ERP Commercial Lifecycle & Account Governance Guide */}
      <div className="sales-pipeline-banner">
        <div className="sales-pipeline-header">
          <div className="sales-pipeline-title">
            <span className="sales-pipeline-dot" />
            <span>Commercial Customer Lifecycle & Account Governance</span>
          </div>
          <span className="sales-pipeline-tag">ISO 9001 · ERP Master Data</span>
        </div>

        <div className="sales-pipeline-stages">
          <div className="sales-pipeline-step">
            <div className="sales-step-num">01</div>
            <div className="sales-step-content">
              <b>Onboarding & KYC</b>
              <span>Entity registration, GSTIN tax validation & contact binding</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">02</div>
            <div className="sales-step-content">
              <b>Credit Assessment</b>
              <span>Exposure limits, payment terms approval & hold controls</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">03</div>
            <div className="sales-step-content">
              <b>Commercial Quoting</b>
              <span>Formal quotes, conversion to confirmed sales orders</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">04</div>
            <div className="sales-step-content">
              <b>Billing & Receivables</b>
              <span>Tax invoice issuance, fulfillment tracking & AR aging</span>
            </div>
          </div>

          <ChevronRight size={14} className="sales-pipeline-arrow" />

          <div className="sales-pipeline-step">
            <div className="sales-step-num">05</div>
            <div className="sales-step-content">
              <b>Cash Settlement</b>
              <span>Bank payments, credit notes, ledger reconciliation</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Linear Modals & Drawers */}
      {mergingCustomer && (
        <CustomerMergeModal
          sourceCustomer={mergingCustomer}
          customers={customers}
          onClose={() => setMergingCustomer(null)}
          onMerged={onMerged}
          notify={notify}
        />
      )}

      {drawerCustomer && (
        <QuickTimelineDrawer
          customer={drawerCustomer}
          onClose={() => setDrawerCustomer(null)}
          onViewAllTimeline={() => {
            setSelectedTimelineCustomerId(drawerCustomer.id);
            setActiveTab('timeline');
          }}
        />
      )}

      {editingTermsCustomer && (
        <EditCustomerTermsModal
          customer={editingTermsCustomer}
          onClose={() => setEditingTermsCustomer(null)}
          onRefresh={onRefresh}
          notify={notify}
        />
      )}
    </div>
  );
}
