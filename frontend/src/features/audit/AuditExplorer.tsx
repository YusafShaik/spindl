import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel, formatAuditValue } from '../../lib/utils/audit-format';

interface AuditEvent {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail?: string | null;
  eventType: string;
  subjectType: string;
  subjectId?: string | null;
  details: Record<string, unknown> | null;
}

interface AuditPage {
  items: AuditEvent[];
  totalElements: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

interface AuditExplorerProps {
  notify: (message: string) => void;
  role?: string;
}

const emptyPage: AuditPage = { items: [], totalElements: 0, totalPages: 0, page: 0, pageSize: 50 };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AuditExplorer({ notify, role }: AuditExplorerProps) {
  const [eventType, setEventType] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [actorId, setActorId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<AuditPage>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const canExport = ['OWNER', 'ADMIN'].includes(role ?? '');

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

  useEffect(() => {
    let current = true;
    setLoading(true);
    apiFetch(`${API}/audit-events?${makeParams(true)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load audit events')))
      .then((data: AuditPage) => { if (current) setResult(data); })
      .catch((error: unknown) => { if (current) notify(errorMessage(error)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [eventType, subjectType, actorId, subjectId, q, from, to, page]);

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
      link.download = `spindl-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const reset = (): void => {
    setEventType(''); setSubjectType(''); setActorId(''); setSubjectId('');
    setQ(''); setFrom(''); setTo(''); setPage(0);
  };
  const changeFilter = (setter: (value: string) => void, value: string): void => {
    setter(value);
    setPage(0);
  };

  return <div className="audit-layout"><section className="panel directory-panel">
    <div className="panel-header directory-top"><div><h2>Audit log <span className="record-count">{result.totalElements}</span></h2><p>Review workspace activity. Passwords, tokens, secrets, and full email addresses are masked.</p></div>{canExport && <button className="button button-secondary" disabled={exporting} onClick={exportCsv}><Download size={14}/>{exporting ? 'Exporting…' : 'Export CSV'}</button>}</div>
    <div className="audit-filters">
      <label>Search<input placeholder="Actor or event" value={q} onChange={(event) => changeFilter(setQ, event.target.value)}/></label>
      <label>Event type<input placeholder="e.g. PURCHASE_ORDER_APPROVED" value={eventType} onChange={(event) => changeFilter(setEventType, event.target.value)}/></label>
      <label>Subject type<input placeholder="e.g. purchase_order" value={subjectType} onChange={(event) => changeFilter(setSubjectType, event.target.value)}/></label>
      <label>Actor ID<input placeholder="User UUID" value={actorId} onChange={(event) => changeFilter(setActorId, event.target.value)}/></label>
      <label>Subject ID<input placeholder="Record UUID" value={subjectId} onChange={(event) => changeFilter(setSubjectId, event.target.value)}/></label>
      <label>From<input type="date" value={from} onChange={(event) => changeFilter(setFrom, event.target.value)}/></label>
      <label>To<input type="date" value={to} onChange={(event) => changeFilter(setTo, event.target.value)}/></label>
      <button className="filter-button" onClick={reset}>Reset</button>
    </div>
    <div className="table-scroll"><table><thead><tr><th>TIME</th><th>ACTOR</th><th>EVENT</th><th>SUBJECT</th><th>DETAILS</th></tr></thead><tbody>
      {loading ? <tr><td className="empty-cell" colSpan={5}>Loading audit events…</td></tr> : result.items.length ? result.items.map((event) => <tr key={event.id}>
        <td className="date-cell">{new Date(event.createdAt).toLocaleString()}</td>
        <td><span className="party-name"><b>{event.actorName}</b>{event.actorEmail && <small>{event.actorEmail}</small>}</span></td>
        <td className="ref-cell">{event.eventType.replaceAll('_', ' ')}</td>
        <td><span className="party-name"><b>{formatAuditLabel(event.subjectType)}</b><small>{event.subjectId || '—'}</small></span></td>
        <td><details className="audit-details"><summary>View activity details</summary><AuditDetailList details={event.details}/></details></td>
      </tr>) : <tr><td className="empty-cell" colSpan={5}>No audit events match these filters.</td></tr>}
    </tbody></table></div>
    <div className="movement-pagination"><span>Showing {result.totalElements ? page * 50 + 1 : 0}–{Math.min((page + 1) * 50, result.totalElements)} of {result.totalElements}</span><button className="mini-action muted" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><span>Page {result.totalPages ? page + 1 : 0} of {result.totalPages}</span><button className="mini-action muted" disabled={!result.totalPages || page >= result.totalPages - 1 || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div>
  </section></div>;
}

function AuditDetailList({ details, depth = 0 }: { details: unknown; depth?: number }) {
  const entries = details && typeof details === 'object' && !Array.isArray(details)
    ? Object.entries(details)
    : [];
  if (!entries.length) return <small className="audit-no-details">No additional details</small>;
  return <dl className="audit-detail-list">{entries.map(([key, value]) => <div className="audit-detail-row" key={key}>
    <dt>{formatAuditLabel(key)}</dt><dd>{Array.isArray(value)
      ? <ul className="audit-detail-values">{value.map((item, index) => <li key={index}>{item && typeof item === 'object' && depth < 2 ? <AuditDetailList details={item} depth={depth + 1}/> : formatAuditValue(item)}</li>)}</ul>
      : value && typeof value === 'object' && depth < 2 ? <AuditDetailList details={value} depth={depth + 1}/>
      : value && typeof value === 'object' ? 'Additional nested details' : formatAuditValue(value)}</dd>
  </div>)}</dl>;
}
