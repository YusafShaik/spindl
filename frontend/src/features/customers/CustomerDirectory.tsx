import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  GitMerge,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
  User,
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
type TimelineFilter = 'ALL' | 'QUOTE' | 'SALES_ORDER' | 'INVOICE' | 'PAYMENT' | 'CUSTOMER_RETURN';

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

function formatEventType(type: string): { label: string; icon: React.ReactNode; colorClass: string } {
  switch (type.toUpperCase()) {
    case 'SALES_ORDER':
      return { label: 'Sales Order', icon: <ShoppingBag size={12} />, colorClass: 'sales_order' };
    case 'QUOTE':
      return { label: 'Quotation', icon: <FileText size={12} />, colorClass: 'quote' };
    case 'INVOICE':
      return { label: 'Invoice', icon: <FileCheck size={12} />, colorClass: 'invoice' };
    case 'PAYMENT':
      return { label: 'Payment', icon: <IndianRupee size={12} />, colorClass: 'payment' };
    case 'CUSTOMER_RETURN':
      return { label: 'Customer Return', icon: <RotateCcw size={12} />, colorClass: 'customer_return' };
    default:
      return { label: type.replace(/_/g, ' '), icon: <Activity size={12} />, colorClass: 'neutral' };
  }
}

function formatStatus(status: string): string {
  if (!status) return 'Completed';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* ==========================================================================
   LINEAR CUSTOMER TIMELINE WIDGET
   Replaces repetitive raw events with clean, high-density timeline stream
   ========================================================================== */
interface CustomerTimelineWidgetProps {
  customerId: string;
  onOpenProfile?: () => void;
}

function CustomerTimelineWidget({ customerId, onOpenProfile }: CustomerTimelineWidgetProps) {
  const [events, setEvents] = useState<CustomerTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<TimelineFilter>('ALL');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    apiFetch(`${API}/customers/${customerId}/timeline`)
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
      .catch((err: unknown) => {
        if (current) setError(messageFrom(err, 'Could not load timeline'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [customerId]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'ALL') return events;
    return events.filter((ev) => ev.eventType.toUpperCase() === typeFilter);
  }, [events, typeFilter]);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: events.length };
    events.forEach((e) => {
      const t = e.eventType.toUpperCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [events]);

  const totalVolume = useMemo(() => {
    return filteredEvents.reduce((sum, ev) => sum + (parseAmount(ev.amount) || 0), 0);
  }, [filteredEvents]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Event Type Filter Pills & Summary Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`sales-pill-btn ${typeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setTypeFilter('ALL')}
            style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
          >
            All Activity <span className="sales-pill-count">{events.length}</span>
          </button>
          {eventCounts['SALES_ORDER'] > 0 && (
            <button
              type="button"
              className={`sales-pill-btn ${typeFilter === 'SALES_ORDER' ? 'active' : ''}`}
              onClick={() => setTypeFilter('SALES_ORDER')}
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Orders <span className="sales-pill-count">{eventCounts['SALES_ORDER']}</span>
            </button>
          )}
          {eventCounts['QUOTE'] > 0 && (
            <button
              type="button"
              className={`sales-pill-btn ${typeFilter === 'QUOTE' ? 'active' : ''}`}
              onClick={() => setTypeFilter('QUOTE')}
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Quotes <span className="sales-pill-count">{eventCounts['QUOTE']}</span>
            </button>
          )}
          {eventCounts['INVOICE'] > 0 && (
            <button
              type="button"
              className={`sales-pill-btn ${typeFilter === 'INVOICE' ? 'active' : ''}`}
              onClick={() => setTypeFilter('INVOICE')}
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Invoices <span className="sales-pill-count">{eventCounts['INVOICE']}</span>
            </button>
          )}
          {eventCounts['PAYMENT'] > 0 && (
            <button
              type="button"
              className={`sales-pill-btn ${typeFilter === 'PAYMENT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('PAYMENT')}
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Payments <span className="sales-pill-count">{eventCounts['PAYMENT']}</span>
            </button>
          )}
          {eventCounts['CUSTOMER_RETURN'] > 0 && (
            <button
              type="button"
              className={`sales-pill-btn ${typeFilter === 'CUSTOMER_RETURN' ? 'active' : ''}`}
              onClick={() => setTypeFilter('CUSTOMER_RETURN')}
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Returns <span className="sales-pill-count">{eventCounts['CUSTOMER_RETURN']}</span>
            </button>
          )}
        </div>

        {filteredEvents.length > 0 && (
          <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
            <span>{filteredEvents.length} events</span>
            {totalVolume > 0 && (
              <>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>Volume: <strong style={{ color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalVolume)}</strong></span>
              </>
            )}
          </div>
        )}
      </div>

      {/* High-Density Linear Activity Stream */}
      {loading ? (
        <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--sp-text-muted)' }}>
          <Clock size={20} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '12px' }}>Loading transaction activity…</div>
        </div>
      ) : error ? (
        <div style={{ padding: '12px 14px', color: '#dc2626', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', fontSize: '12px' }}>
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="sales-empty-state" style={{ padding: '36px 20px' }}>
          <ShoppingBag size={28} className="sales-empty-icon" />
          <div className="sales-empty-title">No transactions recorded</div>
          <div className="sales-empty-desc">
            {typeFilter !== 'ALL' ? 'No transactions match this category.' : 'This account has no quotes, sales orders, invoices, payments, or credit returns on file.'}
          </div>
        </div>
      ) : (
        <div className="linear-activity-stream">
          <div className="linear-activity-header-row">
            <span>EVENT TYPE</span>
            <span>REFERENCE</span>
            <span>STATUS & DETAILS</span>
            <span style={{ textAlign: 'right' }}>AMOUNT</span>
            <span style={{ textAlign: 'right' }}>DATE & TIME</span>
          </div>

          {filteredEvents.map((ev, idx) => {
            const typeInfo = formatEventType(ev.eventType);
            const statusLabel = formatStatus(ev.status);
            const dateObj = new Date(ev.occurredAt);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const formattedTime = dateObj.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={`${ev.eventType}-${ev.reference}-${idx}`} className="linear-activity-row">
                {/* Event Type */}
                <div>
                  <span className={`linear-activity-type ${typeInfo.colorClass}`}>
                    {typeInfo.icon}
                    <span>{typeInfo.label}</span>
                  </span>
                </div>

                {/* Reference Code */}
                <div>
                  <span
                    className="sales-ref-badge"
                    style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sp-font-mono, monospace)', fontSize: '11px' }}
                  >
                    {ev.reference}
                  </span>
                </div>

                {/* Status & Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                  <span className="sales-status-chip completed" style={{ flexShrink: 0 }}>
                    {statusLabel}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeInfo.label} #{ev.reference}
                  </span>
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right' }}>
                  {ev.amount != null ? (
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(ev.amount)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--sp-text-muted)', fontSize: '12px' }}>—</span>
                  )}
                </div>

                {/* Timestamp */}
                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formattedDate} · {formattedTime}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   EDIT CUSTOMER PROFILE MODAL
   Allows comprehensive editing of name, contact, address, terms, tags
   ========================================================================== */
interface EditCustomerModalProps {
  customer: CustomerRecord;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  notify: (msg: string) => void;
  onCustomerUpdated?: (updated: CustomerRecord) => void;
}

function EditCustomerModal({
  customer,
  onClose,
  onRefresh,
  notify,
  onCustomerUpdated,
}: EditCustomerModalProps) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [contactName, setContactName] = useState(customer.contactName || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [customerType, setCustomerType] = useState(customer.customerType || 'COMPANY');
  const [taxId, setTaxId] = useState(customer.taxId || '');
  const [addressLine1, setAddressLine1] = useState(customer.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(customer.addressLine2 || '');
  const [city, setCity] = useState(customer.city || '');
  const [region, setRegion] = useState(customer.region || '');
  const [postalCode, setPostalCode] = useState(customer.postalCode || '');
  const [countryCode, setCountryCode] = useState(customer.countryCode || 'IN');
  const [paymentTermsDays, setPaymentTermsDays] = useState(customer.paymentTermsDays ?? 30);
  const [creditLimit, setCreditLimit] = useState(customer.creditLimit ? String(customer.creditLimit) : '0');
  const [tags, setTags] = useState(customer.tags || '');
  const [creditHold, setCreditHold] = useState(customer.creditHold ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        status: customer.status || 'Active',
        active: true,
        customerType: customerType.toUpperCase(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        taxId: taxId.trim(),
        paymentTermsDays: Number(paymentTermsDays),
        creditLimit: parseFloat(creditLimit) || 0,
        tags: tags.trim(),
        creditHold,
      };

      const res = await apiFetch(`${API}/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to update customer');
      if (onRefresh) await onRefresh();
      if (onCustomerUpdated && isRecord(body)) {
        onCustomerUpdated(body as unknown as CustomerRecord);
      }
      notify(`Customer ${name} updated successfully`);
      onClose();
    } catch (err) {
      notify(messageFrom(err, 'Could not save customer profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="record-modal" onSubmit={handleSubmit} style={{ width: 'min(640px, 95vw)', maxHeight: '90vh' }}>
        <div className="modal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} />
            </div>
            <div>
              <h2>Edit Customer Account</h2>
              <p>{customer.code} · Master Data & Governance</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Identity & Company */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Company / Customer Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Customer Type
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              >
                <option value="COMPANY">Company / Enterprise</option>
                <option value="INDIVIDUAL">Individual / Retail</option>
              </select>
            </div>
          </div>

          {/* Contact & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Primary Contact Person
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Dr. Sunita Rao"
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Email Address <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98000 00000"
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Tax ID & Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Tax ID / GSTIN
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="e.g. 36AABCB1234F1Z0"
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Industry Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Aerospace, Defense, Tier-1"
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Address Lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Billing & Dispatch Address
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="text"
                placeholder="Address Line 1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Address Line 2 (Optional)"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.6fr', gap: '10px' }}>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Region / State"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Country (IN)"
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Credit Terms & Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Payment Terms (Days)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>0 = Due on receipt, 30 = Net 30d</span>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
                Approved Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                disabled={saving}
                style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>Outstanding exposure: {customer.outstanding}</span>
            </div>
          </div>

          {/* Credit Hold Toggle */}
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
              Blocks order fulfillment and new quotation issuance until released.
            </p>
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--sp-border)' }}>
          <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==========================================================================
   EDIT TERMS MODAL
   ========================================================================== */
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
  notify,
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
        creditHold,
      };

      const res = await apiFetch(`${API}/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
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
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>0 = Due on receipt, 15 = Net 15d, 30 = Net 30d</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', display: 'block', marginBottom: '4px' }}>
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
              style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', boxSizing: 'border-box' }}
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
              Blocks dispatch of sales orders and new quotation issuance until released.
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

/* ==========================================================================
   CUSTOMER MERGE MODAL
   ========================================================================== */
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
  notify,
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
        body: JSON.stringify({ targetCustomerId: targetCustomer.id }),
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
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
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
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
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
              fontSize: '13px',
              boxSizing: 'border-box',
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

/* ==========================================================================
   MAIN CUSTOMER DIRECTORY COMPONENT
   ========================================================================== */
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
  onRefresh,
}: CustomerDirectoryProps) {
  const [activeTab, setActiveTab] = useState<CustomerSubTab>('accounts');
  const [quickPill, setQuickPill] = useState<QuickFilterPill>('ALL');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<CustomerRecord | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [editingTermsCustomer, setEditingTermsCustomer] = useState<CustomerRecord | null>(null);
  const [mergingCustomer, setMergingCustomer] = useState<CustomerRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Dedicated Timeline tab customer selection & filter
  const [selectedTimelineCustomerId, setSelectedTimelineCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [sidebarCustomerSearch, setSidebarCustomerSearch] = useState('');

  // Keep selected customer detail in sync with updated customer records
  useEffect(() => {
    if (selectedCustomerDetail) {
      const fresh = customers.find((c) => c.id === selectedCustomerDetail.id);
      if (fresh) setSelectedCustomerDetail(fresh);
    }
  }, [customers]);

  // Sync selected customer if empty
  useEffect(() => {
    if (!selectedTimelineCustomerId && customers.length > 0) {
      setSelectedTimelineCustomerId(customers[0].id);
    }
  }, [customers, selectedTimelineCustomerId]);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

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
        goodStandingPct,
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

  // Filtered sidebar customers in Timeline tab
  const sidebarCustomers = useMemo(() => {
    if (!sidebarCustomerSearch.trim()) return customers;
    const q = sidebarCustomerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q)
    );
  }, [customers, sidebarCustomerSearch]);

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
      'Tags',
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
      `"${(c.tags || '').replace(/"/g, '""')}"`,
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
        creditHold: nextHold,
      };

      const res = await apiFetch(`${API}/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(body) ?? 'Failed to toggle credit hold');
      if (onRefresh) await onRefresh();
      if (selectedCustomerDetail && selectedCustomerDetail.id === customer.id) {
        setSelectedCustomerDetail((prev) => (prev ? { ...prev, creditHold: nextHold } : null));
      }
      notify(`Customer ${customer.name} ${nextHold ? 'placed on credit hold' : 'released from credit hold'}`);
    } catch (err) {
      notify(messageFrom(err, 'Could not toggle credit hold'));
    }
  };

  const selectedTimelineCustomer = customers.find((c) => c.id === selectedTimelineCustomerId);

  /* =========================================================================
     AUTHENTIC LINEAR CUSTOMER DETAIL VIEW (MATCHING MAINTENANCE & ECO)
     ========================================================================= */
  if (selectedCustomerDetail) {
    const outstandingVal = parseAmount(selectedCustomerDetail.outstanding);
    const limitVal = parseAmount(selectedCustomerDetail.creditLimit);
    const utilization = limitVal > 0 ? Math.min(100, Math.round((outstandingVal / limitVal) * 100)) : 0;
    const isOverLimit = limitVal > 0 && outstandingVal > limitVal;

    return (
      <div className="linear-detail-container">
        {/* Top Bar with Breadcrumbs & Actions */}
        <div className="linear-detail-topbar">
          <div className="linear-detail-breadcrumbs">
            <button
              type="button"
              className="linear-crumb-back"
              onClick={() => setSelectedCustomerDetail(null)}
              title="Return to customer accounts list"
            >
              <ArrowLeft size={13} />
              <span>Customers</span>
            </button>
            <span className="linear-crumb-sep">/</span>
            <span className="linear-crumb-id">{selectedCustomerDetail.code}</span>
          </div>

          <div className="linear-detail-top-actions">
            <CustomFieldEditor resource="customers" recordId={selectedCustomerDetail.id} />

            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => setEditingCustomer(selectedCustomerDetail)}
              title="Edit customer master profile"
            >
              <Building2 size={13} />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => setEditingTermsCustomer(selectedCustomerDetail)}
              title="Edit payment terms and credit limit"
            >
              <ShieldCheck size={13} />
              <span>Credit Terms</span>
            </button>

            <button
              type="button"
              className={`sales-action-btn ${selectedCustomerDetail.creditHold ? 'primary' : 'secondary'}`}
              onClick={() => void toggleCreditHold(selectedCustomerDetail)}
              style={selectedCustomerDetail.creditHold ? { background: '#10b981', borderColor: '#059669', color: '#fff' } : {}}
              title={selectedCustomerDetail.creditHold ? 'Release account from credit hold' : 'Place account on credit hold'}
            >
              {selectedCustomerDetail.creditHold ? 'Release Hold' : 'Place on Hold'}
            </button>

            {['OWNER', 'ADMIN'].includes(role ?? '') && customers.length >= 2 && (
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setMergingCustomer(selectedCustomerDetail)}
                title="Merge duplicate customer into another account"
              >
                <GitMerge size={12} />
                <span>Merge</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Linear Layout */}
        <div className="linear-detail-grid">
          {/* Left Column: Narrative & Detailed Data */}
          <div className="linear-detail-content">
            {/* Hero Customer Card */}
            <div className="sales-table-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span className={`sales-customer-avatar ${selectedCustomerDetail.tone || 'lavender'}`} style={{ width: 46, height: 46, fontSize: '16px', borderRadius: '8px' }}>
                    {selectedCustomerDetail.initials}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h1 className="linear-detail-h1">{selectedCustomerDetail.name}</h1>
                      <span className="customer-code-pill" style={{ cursor: 'default' }}>{selectedCustomerDetail.code}</span>
                      <Status label={selectedCustomerDetail.status} />
                      {selectedCustomerDetail.creditHold && (
                        <span className="customer-risk-chip hold">
                          <AlertTriangle size={11} /> Credit Hold Active
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--sp-text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span>{selectedCustomerDetail.customerType === 'INDIVIDUAL' ? 'Retail / Individual Account' : 'Corporate Enterprise Account'}</span>
                      {selectedCustomerDetail.taxId && (
                        <span>· GSTIN: <strong style={{ color: 'var(--sp-text)' }}>{selectedCustomerDetail.taxId}</strong></span>
                      )}
                      {selectedCustomerDetail.city && (
                        <span>· {selectedCustomerDetail.city}, {selectedCustomerDetail.countryCode || 'IN'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedCustomerDetail.tags && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedCustomerDetail.tags.split(',').map((tag) => (
                      <span key={tag} className="customer-tag-pill" style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick 4-metric strip */}
              <div className="sales-metric-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '4px' }}>
                <div className="sales-metric-card" style={{ padding: '12px 14px' }}>
                  <span className="sales-metric-label">OUTSTANDING BALANCE</span>
                  <div className="sales-metric-val" style={{ fontSize: '16px', color: outstandingVal > 0 ? '#dc2626' : '#16a34a' }}>
                    {selectedCustomerDetail.outstanding}
                  </div>
                  <div className="sales-metric-sub">Open receivables</div>
                </div>

                <div className="sales-metric-card" style={{ padding: '12px 14px' }}>
                  <span className="sales-metric-label">LIFETIME ORDERS</span>
                  <div className="sales-metric-val" style={{ fontSize: '16px' }}>
                    {selectedCustomerDetail.orders || 0}
                  </div>
                  <div className="sales-metric-sub">Orders converted</div>
                </div>

                <div className="sales-metric-card" style={{ padding: '12px 14px' }}>
                  <span className="sales-metric-label">APPROVED CREDIT LINE</span>
                  <div className="sales-metric-val" style={{ fontSize: '16px' }}>
                    {limitVal > 0 ? formatCurrency(limitVal) : 'No limit'}
                  </div>
                  <div className="sales-metric-sub">Risk threshold</div>
                </div>

                <div className="sales-metric-card" style={{ padding: '12px 14px' }}>
                  <span className="sales-metric-label">INVOICE SETTLEMENT</span>
                  <div className="sales-metric-val" style={{ fontSize: '16px' }}>
                    Net {selectedCustomerDetail.paymentTermsDays ?? 30}d
                  </div>
                  <div className="sales-metric-sub">Payment terms</div>
                </div>
              </div>
            </div>

            {/* Primary Contact & Corporate Profile Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Primary Contact Card */}
              <div className="linear-properties-card">
                <div className="linear-properties-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} />
                  <span>Primary Contact & Communication</span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Contact Person</span>
                  <span className="linear-property-value">{selectedCustomerDetail.contactName || '—'}</span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Email Address</span>
                  <span className="linear-property-value">
                    {selectedCustomerDetail.email ? (
                      <a href={`mailto:${selectedCustomerDetail.email}`} style={{ color: 'var(--sp-brand)', textDecoration: 'none' }}>
                        {selectedCustomerDetail.email}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Phone</span>
                  <span className="linear-property-value">
                    {selectedCustomerDetail.phone ? (
                      <a href={`tel:${selectedCustomerDetail.phone}`} style={{ color: 'var(--sp-text)', textDecoration: 'none' }}>
                        {selectedCustomerDetail.phone}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Tax ID / GSTIN</span>
                  <span className="linear-property-value">{selectedCustomerDetail.taxId || '—'}</span>
                </div>
              </div>

              {/* Billing Address Card */}
              <div className="linear-properties-card">
                <div className="linear-properties-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} />
                  <span>Billing & Dispatch Address</span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Street Address</span>
                  <span className="linear-property-value" title={[selectedCustomerDetail.addressLine1, selectedCustomerDetail.addressLine2].filter(Boolean).join(', ')}>
                    {[selectedCustomerDetail.addressLine1, selectedCustomerDetail.addressLine2].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">City</span>
                  <span className="linear-property-value">{selectedCustomerDetail.city || '—'}</span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">State / Region</span>
                  <span className="linear-property-value">{selectedCustomerDetail.region || '—'}</span>
                </div>
                <div className="linear-property-row">
                  <span className="linear-property-label">Postal Code & Country</span>
                  <span className="linear-property-value">
                    {[selectedCustomerDetail.postalCode, selectedCustomerDetail.countryCode || 'IN'].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Redesigned Activity Timeline Widget for this customer */}
            <div className="sales-table-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} style={{ color: 'var(--sp-brand)' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                    Transaction Timeline & History
                  </h3>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Quotes, sales orders, invoices, payments, and credit returns
                </span>
              </div>

              <CustomerTimelineWidget customerId={selectedCustomerDetail.id} />
            </div>
          </div>

          {/* Right Sidebar: Governance & Risk */}
          <div className="linear-properties-sidebar">
            {/* Credit Governance & Risk */}
            <div className="linear-properties-card">
              <div className="linear-properties-title">Credit Governance & Risk</div>
              <div className="linear-property-row">
                <span className="linear-property-label">Credit Status</span>
                <span className="linear-property-value">
                  {selectedCustomerDetail.creditHold ? (
                    <span className="customer-risk-chip hold"><AlertTriangle size={10} /> On Hold</span>
                  ) : (
                    <span className="customer-risk-chip good"><CheckCircle2 size={10} /> Approved</span>
                  )}
                </span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Payment Terms</span>
                <span className="linear-property-value">Net {selectedCustomerDetail.paymentTermsDays ?? 30} days</span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Credit Limit</span>
                <span className="linear-property-value">
                  {limitVal > 0 ? formatCurrency(limitVal) : 'No limit'}
                </span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Outstanding</span>
                <span className="linear-property-value">{selectedCustomerDetail.outstanding}</span>
              </div>

              {/* Credit Utilization Bar */}
              {limitVal > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sp-text-muted)', marginBottom: '4px' }}>
                    <span>Credit Utilization</span>
                    <span style={{ fontWeight: 600, color: isOverLimit ? '#dc2626' : 'var(--sp-text)' }}>
                      {utilization}% {isOverLimit && '(Over Limit)'}
                    </span>
                  </div>
                  <div className="customer-progress-track">
                    <div
                      className={`customer-progress-bar ${isOverLimit ? 'danger' : utilization > 75 ? 'warning' : ''}`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Master Data Card */}
            <div className="linear-properties-card">
              <div className="linear-properties-title">Master Data Specifications</div>
              <div className="linear-property-row">
                <span className="linear-property-label">Customer Code</span>
                <span className="linear-property-value"><span className="sales-ref-badge">{selectedCustomerDetail.code}</span></span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Account Type</span>
                <span className="linear-property-value">{selectedCustomerDetail.customerType || 'Company'}</span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Status</span>
                <span className="linear-property-value">{selectedCustomerDetail.status}</span>
              </div>
              <div className="linear-property-row">
                <span className="linear-property-label">Country Code</span>
                <span className="linear-property-value">{selectedCustomerDetail.countryCode || 'IN'}</span>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="linear-properties-card">
              <div className="linear-properties-title">Quick Actions</div>
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setEditingCustomer(selectedCustomerDetail)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Building2 size={13} />
                <span>Edit Full Profile</span>
              </button>
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setEditingTermsCustomer(selectedCustomerDetail)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <ShieldCheck size={13} />
                <span>Adjust Credit Terms</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modals when in detail view */}
        {editingCustomer && (
          <EditCustomerModal
            customer={editingCustomer}
            onClose={() => setEditingCustomer(null)}
            onRefresh={onRefresh}
            notify={notify}
            onCustomerUpdated={(updated) => setSelectedCustomerDetail(updated)}
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

        {mergingCustomer && (
          <CustomerMergeModal
            sourceCustomer={mergingCustomer}
            customers={customers}
            onClose={() => setMergingCustomer(null)}
            onMerged={async () => {
              await onMerged();
              setSelectedCustomerDetail(null);
            }}
            notify={notify}
          />
        )}
      </div>
    );
  }

  /* =========================================================================
     STANDARD LIST & REGISTER VIEWS
     ========================================================================= */
  return (
    <div className="sales-screen-layout">
      {/* 1. Executive Commercial KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">TOTAL ACCOUNTS</span>
            <Users size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {customers.length} Accounts
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{activeCount} Active</span> · {inactiveCount} Inactive
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">OPEN RECEIVABLES</span>
            <IndianRupee size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalOutstanding)}
          </div>
          <div className="sales-metric-sub">
            Across commercial customer accounts
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">LIFETIME SALES ORDERS</span>
            <ShoppingBag size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {totalOrders} Orders
          </div>
          <div className="sales-metric-sub">
            Fulfillments & quotes converted
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">CREDIT HEALTH & RISK</span>
            {holdCount > 0 ? (
              <ShieldAlert size={13} style={{ color: 'var(--sp-text-muted)' }} />
            ) : (
              <ShieldCheck size={13} style={{ color: 'var(--sp-text-muted)' }} />
            )}
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
          {onRefresh && (
            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              title="Refresh customer data"
            >
              <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          )}

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={14} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Search customers, contacts, GSTIN or tags…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setQuery('')}
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
                className="sales-action-btn secondary"
                onClick={exportDirectoryCSV}
                title="Export filtered customer directory to CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '32%' }}>CUSTOMER & CONTACT</th>
                    <th style={{ width: '10%' }}>CODE</th>
                    <th style={{ width: '14%' }}>TERMS & LIMIT</th>
                    <th style={{ width: '8%' }}>ORDERS</th>
                    <th style={{ width: '12%' }}>OUTSTANDING</th>
                    <th style={{ width: '10%' }}>STATUS</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>ACTIONS</th>
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
                        <tr
                          key={customer.id}
                          className="sales-row"
                          onClick={() => setSelectedCustomerDetail(customer)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Customer & Contact */}
                          <td>
                            <div className="sales-customer-cell">
                              <span className={`sales-customer-avatar ${customer.tone || 'lavender'}`}>
                                {customer.initials}
                              </span>
                              <div className="customer-info-cell">
                                <strong style={{ color: 'var(--sp-text)', fontSize: '13px' }}>
                                  {customer.name}
                                </strong>
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

                          {/* Customer Code - Clickable Link Pill */}
                          <td>
                            <button
                              type="button"
                              className="customer-code-pill interactive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerDetail(customer);
                              }}
                              title="View full customer details"
                            >
                              <span>{customer.code}</span>
                              <ArrowUpRight size={11} className="order-link-arrow" />
                            </button>
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
                            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
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
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div className="sales-actions-cell" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                onClick={() => setSelectedCustomerDetail(customer)}
                                title="View customer profile and history"
                              >
                                <span>Details</span>
                              </button>

                              <CustomFieldEditor resource="customers" recordId={customer.id} />

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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '16px' }}>
          {/* Customer Selector Sidebar with Search */}
          <div className="sales-table-card" style={{ padding: '14px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Customer Accounts
              </span>
              <span className="sales-pill-count">{customers.length}</span>
            </div>

            {/* Sidebar Search */}
            <div className="sales-search-box" style={{ width: '100%' }}>
              <Search size={13} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Filter accounts…"
                value={sidebarCustomerSearch}
                onChange={(e) => setSidebarCustomerSearch(e.target.value)}
                style={{ height: '30px', fontSize: '12px' }}
              />
              {sidebarCustomerSearch && (
                <button
                  type="button"
                  className="sales-search-clear"
                  onClick={() => setSidebarCustomerSearch('')}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Account List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '520px', overflowY: 'auto' }}>
              {sidebarCustomers.length === 0 ? (
                <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                  No accounts found
                </div>
              ) : (
                sidebarCustomers.map((c) => {
                  const isSelected = c.id === selectedTimelineCustomerId;
                  const outstandingNum = parseAmount(c.outstanding);

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
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12.5px', color: isSelected ? 'var(--sp-brand)' : 'var(--sp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </strong>
                        <span className="sales-ref-badge" style={{ fontSize: '10px', marginLeft: '6px', flexShrink: 0 }}>{c.code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        <span>{c.orders} orders</span>
                        <span style={{ fontWeight: 500, color: outstandingNum > 0 ? '#dc2626' : 'var(--sp-text-muted)' }}>
                          {c.outstanding}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Activity Stream View */}
          <div className="sales-table-card" style={{ padding: '14px 16px' }}>
            {selectedTimelineCustomer && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--sp-border)', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`sales-customer-avatar ${selectedTimelineCustomer.tone || 'lavender'}`} style={{ width: 32, height: 32, fontSize: '12px', borderRadius: '6px', flexShrink: 0 }}>
                    {selectedTimelineCustomer.initials}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
                        {selectedTimelineCustomer.name}
                      </h3>
                      <button
                        type="button"
                        className="customer-code-pill interactive"
                        onClick={() => setSelectedCustomerDetail(selectedTimelineCustomer)}
                        title="Open full customer profile"
                      >
                        <span>{selectedTimelineCustomer.code}</span>
                        <ArrowUpRight size={11} className="order-link-arrow" />
                      </button>
                      {selectedTimelineCustomer.creditHold && (
                        <span className="customer-risk-chip hold">
                          <AlertTriangle size={10} /> Credit Hold
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', margin: '2px 0 0' }}>
                      {[selectedTimelineCustomer.contactName, selectedTimelineCustomer.phone, selectedTimelineCustomer.email, selectedTimelineCustomer.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: parseAmount(selectedTimelineCustomer.outstanding) > 0 ? '#dc2626' : 'var(--sp-text)' }}>
                      Outstanding: {selectedTimelineCustomer.outstanding}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '1px' }}>
                      Terms: Net {selectedTimelineCustomer.paymentTermsDays ?? 30}d
                    </div>
                  </div>

                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    onClick={() => setSelectedCustomerDetail(selectedTimelineCustomer)}
                    style={{ height: '30px', fontSize: '12px' }}
                  >
                    <span>View Profile</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {selectedTimelineCustomerId ? (
              <CustomerTimelineWidget
                customerId={selectedTimelineCustomerId}
                onOpenProfile={() => {
                  if (selectedTimelineCustomer) setSelectedCustomerDetail(selectedTimelineCustomer);
                }}
              />
            ) : (
              <div className="sales-empty-state" style={{ padding: '60px 20px' }}>
                <Users size={32} className="sales-empty-icon" />
                <div className="sales-empty-title">Select a customer account</div>
                <div className="sales-empty-desc">Choose an account from the left sidebar to view their activity stream.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: Credit Terms & Governance Register */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Credit Overview Banner */}
          <div className="sales-metric-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="sales-metric-card">
              <div className="sales-metric-header">
                <span className="sales-metric-label">TOTAL COMMERCIAL EXPOSURE</span>
                <IndianRupee size={13} style={{ color: 'var(--sp-text-muted)' }} />
              </div>
              <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalOutstanding)}
              </div>
              <div className="sales-metric-sub">
                Across {customers.length} business accounts
              </div>
            </div>

            <div className="sales-metric-card">
              <div className="sales-metric-header">
                <span className="sales-metric-label">CREDIT RISK STANDING</span>
                {holdCount > 0 ? (
                  <ShieldAlert size={13} style={{ color: 'var(--sp-text-muted)' }} />
                ) : (
                  <ShieldCheck size={13} style={{ color: 'var(--sp-text-muted)' }} />
                )}
              </div>
              <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {holdCount} Accounts on Hold
              </div>
              <div className="sales-metric-sub">
                <span className={holdCount > 0 ? 'sales-sub-warning' : 'sales-sub-highlight'}>
                  {goodStandingPct}%
                </span> in good compliance
              </div>
            </div>

            <div className="sales-metric-card">
              <div className="sales-metric-header">
                <span className="sales-metric-label">STANDARD SETTLEMENT TERMS</span>
                <Calendar size={13} style={{ color: 'var(--sp-text-muted)' }} />
              </div>
              <div className="sales-metric-val">
                Net 15d – Net 45d
              </div>
              <div className="sales-metric-sub">
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
                    <th style={{ width: '22%' }}>CUSTOMER</th>
                    <th style={{ width: '8%' }}>CODE</th>
                    <th style={{ width: '12%' }}>TAX ID / GSTIN</th>
                    <th style={{ width: '9%' }}>TERMS</th>
                    <th style={{ width: '12%' }}>CREDIT LIMIT</th>
                    <th style={{ width: '11%' }}>OUTSTANDING</th>
                    <th style={{ width: '11%' }}>UTILIZATION</th>
                    <th style={{ width: '7%' }}>CREDIT STATUS</th>
                    <th style={{ width: '8%', textAlign: 'right' }}>GOVERNANCE ACTION</th>
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
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerDetail(c)}
                            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          >
                            <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{c.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              {c.city ? `${c.city}, ${c.countryCode || 'IN'}` : c.customerType || 'Company'}
                            </div>
                          </button>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="customer-code-pill interactive"
                            onClick={() => setSelectedCustomerDetail(c)}
                            title="View full customer profile"
                          >
                            <span>{c.code}</span>
                            <ArrowUpRight size={11} className="order-link-arrow" />
                          </button>
                        </td>

                        <td>
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {c.taxId || '—'}
                          </span>
                        </td>

                        <td>
                          <span className="sales-warehouse-pill">
                            Net {c.paymentTermsDays ?? 30}d
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
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
                              {isOverLimit && <span style={{ color: '#dc2626', fontWeight: 500 }}>Breached</span>}
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

      {/* Modals & Dialogs */}
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onRefresh={onRefresh}
          notify={notify}
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

      {mergingCustomer && (
        <CustomerMergeModal
          sourceCustomer={mergingCustomer}
          customers={customers}
          onClose={() => setMergingCustomer(null)}
          onMerged={onMerged}
          notify={notify}
        />
      )}
    </div>
  );
}
