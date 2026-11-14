import { useEffect, useState } from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatCurrency } from '../../lib/utils/currency';
import type { CustomerRecord, CustomerTimelineEvent } from '../../types/customer';
import { CustomFieldEditor } from './CustomFieldEditor';

interface CustomerDirectoryProps {
  title: string;
  subtitle: string;
  query: string;
  setQuery: (query: string) => void;
  data: CustomerRecord[];
  customers: CustomerRecord[];
  role?: string;
  onMerged: () => Promise<void>;
  notify: (message: string) => void;
}

interface CustomerMergeActionProps {
  customer: CustomerRecord;
  customers: CustomerRecord[];
  role?: string;
  onMerged: () => Promise<void>;
  notify: (message: string) => void;
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
  return isRecord(value)
    && typeof value.occurredAt === 'string'
    && typeof value.eventType === 'string'
    && typeof value.reference === 'string'
    && typeof value.status === 'string'
    && (value.amount === null || typeof value.amount === 'number' || typeof value.amount === 'string');
}

function CustomerMergeAction({ customer, customers, role, onMerged, notify }: CustomerMergeActionProps) {
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!['OWNER', 'ADMIN'].includes(role ?? '') || customers.length < 2) return null;

  const merge = async () => {
    const target = customers.find((row) => row.id === targetId);
    if (!target) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/customers/${customer.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCustomerId: target.id }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body) ?? 'Could not merge customers');
      await onMerged();
    } catch (error) {
      notify(messageFrom(error, 'Could not merge customers'));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return <details className="customer-merge"><summary>Merge</summary>
    <select aria-label={`Merge ${customer.name} into`} value={targetId} onChange={(event) => { setTargetId(event.target.value); setConfirming(false); }}>
      <option value="">Select surviving record</option>
      {customers.filter((row) => row.id !== customer.id).map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}
    </select>
    <button className="mini-action" disabled={!targetId || saving} onClick={() => void merge()}>{saving ? 'Merging…' : confirming ? 'Confirm merge' : 'Review merge'}</button>
    {confirming && <div className="merge-confirm-note">{customer.name} will be archived. Its orders, invoices, leads, attachments, and custom fields will move to {customers.find((row) => row.id === targetId)?.name}.<button type="button" className="mini-action muted" onClick={() => setConfirming(false)}>Cancel</button></div>}
  </details>;
}

function CustomerTimeline({ customer }: { customer: CustomerRecord }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CustomerTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setError('');
    apiFetch(`${API}/customers/${customer.id}/timeline`)
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(apiError(body) ?? 'Could not load customer activity');
        }
        if (!Array.isArray(body) || !body.every(isCustomerTimelineEvent)) throw new Error('The server returned invalid customer activity');
        if (current) setEvents(body);
      })
      .catch((reason: unknown) => { if (current) setError(messageFrom(reason, 'Could not load customer activity')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, customer.id]);

  return <div className="customer-timeline"><button type="button" className="mini-action muted" onClick={() => setOpen((value) => !value)}>{open ? 'Hide activity' : 'Activity'}</button>{open && <div className="customer-timeline-list">{loading ? <small>Loading activity…</small> : error ? <small>{error}</small> : events.length ? events.map((event, index) => <div key={`${event.eventType}-${event.reference}-${index}`}><b>{event.eventType.replaceAll('_', ' ').toLowerCase()}</b><span>{event.reference} · {event.status}</span><time>{new Date(event.occurredAt).toLocaleString()}</time>{event.amount != null && <strong>{formatCurrency(event.amount)}</strong>}</div>) : <small>No sales activity recorded yet.</small>}</div>}</div>;
}

export function CustomerDirectory({ title, subtitle, query, setQuery, data, customers, role, onMerged, notify }: CustomerDirectoryProps) {
  return <section className="panel directory-panel">
    <div className="panel-header directory-top"><div><h2>{title} <span className="record-count">{data.length}</span></h2><p>{subtitle}</p></div><button className="filter-button" onClick={() => setQuery('')}><Filter size={15} aria-hidden="true" /> Filter</button></div>
    <div className="table-controls"><div className="search-box"><Search size={15} aria-hidden="true" /><input className="search-input" placeholder="Search customers, contacts or tags..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>/</kbd></div><button className="filter-button" onClick={() => setQuery('')}>All customers <ChevronDown size={14} aria-hidden="true" /></button></div>
    <div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>CUSTOMER ID</th><th>ORDERS</th><th>OUTSTANDING</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{data.map((customer) => <tr key={customer.id}>
      <td><div className="party-cell"><span className={`party-avatar ${customer.tone}`}>{customer.initials}</span><span className="party-name"><b>{customer.name}</b><small>{[customer.email, customer.phone, customer.contactName, customer.city, customer.countryCode].filter(Boolean).join(' · ')}</small>{(customer.creditHold || customer.tags) && <small>{customer.creditHold ? 'Credit hold' : ''}{customer.creditHold && customer.tags ? ' · ' : ''}{customer.tags || ''}</small>}</span></div></td>
      <td className="ref-cell">{customer.code}</td><td>{customer.orders}</td><td className="amount-cell">{customer.outstanding}</td><td><Status label={customer.status} /></td>
      <td><CustomFieldEditor resource="customers" recordId={customer.id} /><CustomerTimeline customer={customer} /><CustomerMergeAction customer={customer} customers={customers} role={role} onMerged={onMerged} notify={notify} /></td>
    </tr>)}</tbody></table></div>
  </section>;
}
