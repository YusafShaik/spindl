import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';

type ReportColumnType = 'text' | 'number' | 'boolean' | 'date';
type ReportMetricFunction = 'count' | 'sum' | 'average' | 'minimum' | 'maximum';
type ReportFilterOperator = 'equals' | 'contains' | 'greater_than' | 'at_least' | 'less_than' | 'at_most';
type ReportCell = string | number | boolean | null;

interface ReportColumn { key: string; label: string; type: ReportColumnType; }
interface ReportSource { key: string; label: string; columns: ReportColumn[]; }
interface ReportFilter { field: string; operator: ReportFilterOperator; value: string; }
interface ReportMetric { function: ReportMetricFunction; field: string; }
interface ReportDefinition {
  id: string; name: string; dataSource: string; columns: string[];
  filters?: ReportFilter[]; groupBy: string | null; metrics?: ReportMetric[];
}
interface ReportRunResult {
  name: string; dataSource: string; columns: string[]; totalElements: number;
  page: number; pageSize: number; rows: Array<Record<string, ReportCell>>;
}
interface ReportBuilderProps { notify: (message: string) => void; role?: string; }
type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
interface SavedReportSchedule {
  id: string; reportId: string; frequency: ScheduleFrequency; runAt: string;
  timezone: string; enabled: boolean; nextRunAt: string;
}
interface ScheduledReportRun {
  id: string; reportName: string; status: string; completedAt: string;
  errorMessage: string | null; result: { columns: string[]; rows: Array<Record<string, ReportCell>> } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isColumnType(value: unknown): value is ReportColumnType { return value === 'text' || value === 'number' || value === 'boolean' || value === 'date'; }
function isMetricFunction(value: string): value is ReportMetricFunction { return value === 'count' || value === 'sum' || value === 'average' || value === 'minimum' || value === 'maximum'; }
function isFilterOperator(value: string): value is ReportFilterOperator { return ['equals', 'contains', 'greater_than', 'at_least', 'less_than', 'at_most'].includes(value); }
function isColumn(value: unknown): value is ReportColumn { return isRecord(value) && typeof value.key === 'string' && typeof value.label === 'string' && isColumnType(value.type); }
function isSource(value: unknown): value is ReportSource { return isRecord(value) && typeof value.key === 'string' && typeof value.label === 'string' && Array.isArray(value.columns) && value.columns.every(isColumn); }
function isFilter(value: unknown): value is ReportFilter { return isRecord(value) && typeof value.field === 'string' && typeof value.operator === 'string' && isFilterOperator(value.operator) && typeof value.value === 'string'; }
function isMetric(value: unknown): value is ReportMetric { return isRecord(value) && typeof value.function === 'string' && isMetricFunction(value.function) && typeof value.field === 'string'; }
function isDefinition(value: unknown): value is ReportDefinition {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.dataSource === 'string' && Array.isArray(value.columns) && value.columns.every((column) => typeof column === 'string') && (value.filters === undefined || Array.isArray(value.filters) && value.filters.every(isFilter)) && (value.metrics === undefined || Array.isArray(value.metrics) && value.metrics.every(isMetric)) && (value.groupBy === null || typeof value.groupBy === 'string');
}
function isCell(value: unknown): value is ReportCell { return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'; }
function isRunResult(value: unknown): value is ReportRunResult {
  return isRecord(value) && typeof value.name === 'string' && typeof value.dataSource === 'string' && Array.isArray(value.columns) && value.columns.every((column) => typeof column === 'string') && typeof value.totalElements === 'number' && typeof value.page === 'number' && typeof value.pageSize === 'number' && Array.isArray(value.rows) && value.rows.every((row) => isRecord(row) && Object.values(row).every(isCell));
}
function isSchedule(value: unknown): value is SavedReportSchedule {
  return isRecord(value) && typeof value.id === 'string' && typeof value.reportId === 'string' && (value.frequency === 'DAILY' || value.frequency === 'WEEKLY' || value.frequency === 'MONTHLY') && typeof value.runAt === 'string' && typeof value.timezone === 'string' && typeof value.enabled === 'boolean' && typeof value.nextRunAt === 'string';
}
function isScheduledRun(value: unknown): value is ScheduledReportRun {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.reportName !== 'string' || typeof value.status !== 'string' || typeof value.completedAt !== 'string' || !(value.errorMessage === null || typeof value.errorMessage === 'string')) return false;
  if (value.result === null) return true;
  return isRecord(value.result) && Array.isArray(value.result.columns) && value.result.columns.every((column) => typeof column === 'string') && Array.isArray(value.result.rows) && value.result.rows.every((row) => isRecord(row) && Object.values(row).every(isCell));
}
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function responseError(response: Response, fallback: string): Promise<Error> { const body = await response.json().catch(() => ({})); return new Error(body.detail || body.message || fallback); }

export function ReportBuilder({ notify, role }: ReportBuilderProps) {
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [sourceKey, setSourceKey] = useState('customers');
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState('');
  const [metrics, setMetrics] = useState<ReportMetric[]>([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canManage = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');

  const load = async (): Promise<void> => {
    const [sourceResponse, definitionResponse] = await Promise.all([apiFetch(`${API}/report-builder/sources`), apiFetch(`${API}/report-builder/definitions`)]);
    if (!sourceResponse.ok || !definitionResponse.ok) throw new Error('Could not load saved reports');
    const [sourcePayload, definitionPayload]: [unknown, unknown] = await Promise.all([sourceResponse.json(), definitionResponse.json()]);
    if (!Array.isArray(sourcePayload) || !sourcePayload.every(isSource) || !Array.isArray(definitionPayload) || !definitionPayload.every(isDefinition)) throw new Error('Invalid saved report response');
    const sourceData = sourcePayload;
    const definitionData = definitionPayload;
    setSources(sourceData);
    setDefinitions(definitionData);
    if (sourceData.length) {
      const selected = sourceData.find((source) => source.key === sourceKey) || sourceData[0];
      setSourceKey(selected.key);
      if (!columns.length) setColumns(selected.columns.slice(0, 4).map((column) => column.key));
    }
  };
  useEffect(() => { void load().catch((error: unknown) => notify(messageFrom(error))); }, []);
  const selectedSource = sources.find((source) => source.key === sourceKey);
  const resultSource = sources.find((source) => source.key === result?.dataSource);

  const toggleColumn = (key: string): void => setColumns((current) => current.includes(key) ? current.filter((column) => column !== key) : current.length >= 12 ? current : [...current, key]);
  const addFilter = (): void => {
    const first = selectedSource?.columns.find((column) => !filters.some((filter) => filter.field === column.key));
    if (first && filters.length < 8) setFilters((current) => [...current, { field: first.key, operator: first.type === 'text' ? 'contains' : 'equals', value: first.type === 'boolean' ? 'false' : '' }]);
  };
  const filterOperators = (type: ReportColumnType): Array<[ReportFilterOperator, string]> => type === 'text'
    ? [['equals', 'Equals'], ['contains', 'Contains']]
    : type === 'boolean' ? [['equals', 'Equals']] : [['equals', 'Equals'], ['greater_than', 'Greater than'], ['at_least', 'At least'], ['less_than', 'Less than'], ['at_most', 'At most']];

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/report-builder/definitions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, dataSource: sourceKey, columns, filters, groupBy: groupBy || null, metrics }) });
      if (!response.ok) throw await responseError(response, 'Could not save report');
      const body: unknown = await response.json();
      const savedName = isRecord(body) && typeof body.name === 'string' ? body.name : name;
      setName('');
      await load();
      notify(`Saved report ${savedName}`);
    } catch (error) { notify(messageFrom(error)); }
    finally { setSaving(false); }
  };

  const run = async (definition: ReportDefinition): Promise<void> => {
    setLoading(true);
    setActiveId(definition.id);
    try {
      const params = new URLSearchParams({ page: '0', size: '100' });
      if (search.trim()) params.set('q', search.trim());
      const response = await apiFetch(`${API}/report-builder/definitions/${definition.id}/run?${params}`);
      if (!response.ok) throw await responseError(response, 'Could not run report');
      const body: unknown = await response.json();
      if (!isRunResult(body)) throw new Error('Invalid saved report result');
      setResult(body);
    } catch (error) { notify(messageFrom(error)); }
    finally { setLoading(false); }
  };

  const remove = async (definition: ReportDefinition): Promise<void> => {
    try {
      const response = await apiFetch(`${API}/report-builder/definitions/${definition.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete saved report');
      setDefinitions((current) => current.filter((row) => row.id !== definition.id));
      if (activeId === definition.id) { setActiveId(''); setResult(null); }
      notify('Saved report deleted');
    } catch (error) { notify(messageFrom(error)); }
  };

  const exportCsv = (): void => {
    if (!result) return;
    const quote = (value: ReportCell): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [result.columns.map((key) => quote(key === 'groupValue' ? 'Group' : resultSource?.columns.find((column) => column.key === key)?.label || key.replaceAll('_', ' '))).join(','), ...result.rows.map((row) => result.columns.map((key) => quote(row[key] ?? null)).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `spindl-${result.dataSource}-report.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <section className="panel directory-panel saved-report-builder"><div className="panel-header directory-top"><div><h2>Custom report builder</h2><p>Save a tenant-scoped report from approved fields. Search and export up to 100 matching rows at a time.</p></div></div>
    <form className="transaction-filters" onSubmit={(event) => void save(event)}>
      <label>Report name<input value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} placeholder="Active customer directory"/></label>
      <label>Data source<select value={sourceKey} onChange={(event) => { const next = sources.find((source) => source.key === event.target.value); setSourceKey(event.target.value); setColumns(next?.columns.slice(0, 4).map((column) => column.key) || []); setFilters([]); setGroupBy(''); setMetrics([]); setResult(null); }}>{sources.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
      <button className="button button-primary" disabled={saving || !name.trim() || !columns.length || filters.some((filter) => !String(filter.value).trim()) || !canManage}>{saving ? 'Saving…' : 'Save report'}</button>
      <div className="report-builder-columns">{selectedSource?.columns.map((column) => <label key={column.key}><input type="checkbox" checked={columns.includes(column.key)} onChange={() => toggleColumn(column.key)}/>{column.label}</label>)}</div>
      <div className="report-builder-filters"><div className="report-builder-filter-heading"><b>Grouping and summary</b></div><div className="report-builder-filter-row"><label>Group rows by<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="">No grouping</option>{selectedSource?.columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><button type="button" className="filter-button" disabled={!groupBy || metrics.length >= 4 || !selectedSource?.columns.some((column) => column.type === 'number')} onClick={() => { const field = selectedSource?.columns.find((column) => column.type === 'number' && !metrics.some((metric) => metric.field === column.key))?.key || '*'; setMetrics((current) => current.length < 4 ? [...current, { function: 'sum', field }] : current); }}>Add metric</button></div>
        {metrics.map((metric, index) => <div className="report-builder-filter-row" key={`metric-${index}`}><label>Calculation<select value={metric.function} onChange={(event) => { const metricFunction = event.target.value; if (!isMetricFunction(metricFunction)) return; setMetrics((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, function: metricFunction, field: metricFunction === 'count' ? '*' : row.field === '*' ? selectedSource?.columns.find((column) => column.type === 'number')?.key || '' : row.field } : row)); }}><option value="count">Count</option><option value="sum">Sum</option><option value="average">Average</option><option value="minimum">Minimum</option><option value="maximum">Maximum</option></select></label>{metric.function !== 'count' && <label>Numeric field<select value={metric.field} onChange={(event) => setMetrics((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, field: event.target.value } : row))}>{selectedSource?.columns.filter((column) => column.type === 'number').map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>}{metric.function === 'count' && <label>Count<select value={metric.field} onChange={(event) => setMetrics((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, field: event.target.value } : row))}><option value="*">All rows</option>{selectedSource?.columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>}<button type="button" className="mini-action muted" onClick={() => setMetrics((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>)}
      </div>
      <div className="report-builder-filters"><div className="report-builder-filter-heading"><b>Filters</b><button type="button" className="filter-button" disabled={filters.length >= 8 || !selectedSource} onClick={addFilter}>Add filter</button></div>
        {filters.map((filter, index) => { const meta = selectedSource?.columns.find((column) => column.key === filter.field); const type = meta?.type || 'text'; return <div className="report-builder-filter-row" key={index}><label>Field<select value={filter.field} onChange={(event) => { const field = event.target.value; const nextType = selectedSource?.columns.find((column) => column.key === field)?.type || 'text'; const operator: ReportFilterOperator = nextType === 'text' ? 'contains' : 'equals'; setFilters((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, field, operator, value: nextType === 'boolean' ? 'false' : '' } : row)); }}>{selectedSource?.columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><label>Condition<select value={filter.operator} onChange={(event) => { const operator = event.target.value; if (isFilterOperator(operator)) setFilters((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, operator } : row)); }}>{filterOperators(type).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Value{type === 'boolean' ? <select value={filter.value} onChange={(event) => setFilters((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))}><option value="true">Yes</option><option value="false">No</option></select> : <input type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} step={type === 'number' ? 'any' : undefined} value={filter.value} onChange={(event) => setFilters((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))} placeholder={type === 'text' ? 'Enter text' : undefined}/>}</label><button type="button" className="mini-action muted" onClick={() => setFilters((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>; })}
      </div>
    </form>
    <div className="report-builder-saved"><b>Saved reports</b>{definitions.length ? definitions.map((definition) => <article key={definition.id}><span><strong>{definition.name}</strong><small>{sources.find((source) => source.key === definition.dataSource)?.label || definition.dataSource} · {definition.columns.length} fields · {definition.filters?.length || 0} filters{definition.groupBy ? ` · grouped by ${sources.find((source) => source.key === definition.dataSource)?.columns.find((column) => column.key === definition.groupBy)?.label || definition.groupBy}` : ''}</small></span><div><button className="mini-action" disabled={loading} onClick={() => void run(definition)}>Run</button>{canManage && <button className="mini-action muted" onClick={() => void remove(definition)}>Delete</button>}</div></article>) : <p className="empty-cell">No custom reports saved yet.</p>}</div>
    {result && <><div className="report-builder-result-heading"><div><b>{result.name}</b><small>{result.totalElements.toLocaleString()} matching records · showing first {result.rows.length}</small></div><div className="report-builder-search"><input value={search} placeholder="Search selected columns" onChange={(event) => setSearch(event.target.value)}/><button className="mini-action" disabled={loading} onClick={() => { const definition = definitions.find((item) => item.id === activeId); if (definition) void run(definition); }}>Search</button><button className="mini-action muted" onClick={exportCsv}>Export CSV</button></div></div><div className="table-scroll"><table><thead><tr>{result.columns.map((key) => <th key={key}>{key === 'groupValue' ? 'Group' : resultSource?.columns.find((column) => column.key === key)?.label || key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{loading ? <tr><td className="empty-cell" colSpan={result.columns.length}>Running report…</td></tr> : result.rows.length ? result.rows.map((row, index) => <tr key={index}>{result.columns.map((key) => <td key={key}>{row[key] === true ? 'Yes' : row[key] === false ? 'No' : row[key] ?? '—'}</td>)}</tr>) : <tr><td className="empty-cell" colSpan={result.columns.length}>No rows match this search.</td></tr>}</tbody></table></div></>}
  </section>;
}

export function SavedReportSchedulePanel({ notify, role }: ReportBuilderProps) {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [schedules, setSchedules] = useState<SavedReportSchedule[]>([]);
  const [reportId, setReportId] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('DAILY');
  const [runAt, setRunAt] = useState('09:00');
  const [weekDay, setWeekDay] = useState('1');
  const [monthDay, setMonthDay] = useState('1');
  const [runs, setRuns] = useState<ScheduledReportRun[]>([]);
  const [activeSchedule, setActiveSchedule] = useState('');
  const [saving, setSaving] = useState(false);
  const canManage = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');
  const path = `${API}/report-builder/schedules`;

  const load = async (): Promise<void> => {
    const [reportResponse, scheduleResponse] = await Promise.all([apiFetch(`${API}/report-builder/definitions`), apiFetch(path)]);
    if (!reportResponse.ok || !scheduleResponse.ok) throw new Error('Could not load report schedules');
    const [reportPayload, schedulePayload]: [unknown, unknown] = await Promise.all([reportResponse.json(), scheduleResponse.json()]);
    if (!Array.isArray(reportPayload) || !reportPayload.every(isDefinition) || !Array.isArray(schedulePayload) || !schedulePayload.every(isSchedule)) throw new Error('Invalid report schedule response');
    setReports(reportPayload);
    setSchedules(schedulePayload);
    if (!reportId && reportPayload.length) setReportId(reportPayload[0].id);
  };
  useEffect(() => { if (canManage) void load().catch((error: unknown) => notify(messageFrom(error))); }, [canManage]);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { reportId, frequency, runAt: `${runAt}:00`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', weekDay: frequency === 'WEEKLY' ? Number(weekDay) : null, monthDay: frequency === 'MONTHLY' ? Number(monthDay) : null };
      const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw await responseError(response, 'Could not schedule report');
      await response.json();
      await load();
      notify('Report schedule created');
    } catch (error) { notify(messageFrom(error)); }
    finally { setSaving(false); }
  };

  const disable = async (schedule: SavedReportSchedule): Promise<void> => {
    try {
      const response = await apiFetch(`${path}/${schedule.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disable report schedule');
      await load();
      if (activeSchedule === schedule.id) { setActiveSchedule(''); setRuns([]); }
      notify('Report schedule disabled');
    } catch (error) { notify(messageFrom(error)); }
  };

  const showRuns = async (schedule: SavedReportSchedule): Promise<void> => {
    try {
      const response = await apiFetch(`${path}/${schedule.id}/runs`);
      const payload: unknown = await response.json().catch(() => []);
      if (!response.ok) throw new Error('Could not load scheduled report runs');
      if (!Array.isArray(payload) || !payload.every(isScheduledRun)) throw new Error('Invalid scheduled report runs response');
      setRuns(payload);
      setActiveSchedule(schedule.id);
    } catch (error) { notify(messageFrom(error)); }
  };

  const download = (run: ScheduledReportRun): void => {
    const columns = run.result?.columns || [];
    const rows = run.result?.rows || [];
    const quote = (value: ReportCell): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) => quote(row[column] ?? null)).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'spindl-scheduled-report.csv'; link.click(); URL.revokeObjectURL(url);
  };

  if (!canManage) return null;
  return <section className="panel directory-panel saved-report-builder"><div className="panel-header directory-top"><div><h2>Scheduled reports</h2><p>Save a daily, weekly, or monthly report run in this workspace. Each run keeps up to 100 rows for download.</p></div></div><form className="transaction-filters" onSubmit={(event) => void create(event)}><label>Saved report<select required value={reportId} onChange={(event) => setReportId(event.target.value)}><option value="">Choose a report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}</select></label><label>Repeat<select value={frequency} onChange={(event) => { const value = event.target.value; if (value === 'DAILY' || value === 'WEEKLY' || value === 'MONTHLY') setFrequency(value); }}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>{frequency === 'WEEKLY' && <label>Day of week<select value={weekDay} onChange={(event) => setWeekDay(event.target.value)}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>}{frequency === 'MONTHLY' && <label>Day of month<select value={monthDay} onChange={(event) => setMonthDay(event.target.value)}>{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}<label>Run time<input type="time" required value={runAt} onChange={(event) => setRunAt(event.target.value)}/></label><button className="button button-primary" disabled={saving || !reportId}>{saving ? 'Saving…' : 'Schedule report'}</button></form>
    <div className="report-builder-saved"><b>Workspace schedules</b>{schedules.length ? schedules.map((schedule) => <article key={schedule.id}><span><strong>{reports.find((report) => report.id === schedule.reportId)?.name || 'Saved report'} · {schedule.enabled ? 'Active' : 'Disabled'}</strong><small>{schedule.frequency.toLowerCase()} at {schedule.runAt.slice(0, 5)} ({schedule.timezone}) · Next run {new Date(schedule.nextRunAt).toLocaleString()}</small></span><div><button className="mini-action" onClick={() => void showRuns(schedule)}>Run history</button>{schedule.enabled && <button className="mini-action muted" onClick={() => void disable(schedule)}>Disable</button>}</div></article>) : <p className="empty-cell">No reports are scheduled.</p>}</div>
    {activeSchedule && <div className="report-builder-saved"><b>Recent scheduled runs</b>{runs.length ? runs.map((run) => <article key={run.id}><span><strong>{run.reportName} · {run.status === 'COMPLETED' ? 'Ready to download' : 'Could not complete'}</strong><small>{new Date(run.completedAt).toLocaleString()}{run.errorMessage ? ` · ${run.errorMessage}` : ''}</small></span>{run.status === 'COMPLETED' && <button className="mini-action" onClick={() => download(run)}>Download CSV</button>}</article>) : <p className="empty-cell">No scheduled runs yet.</p>}</div>}
  </section>;
}
