import { useEffect, useState, type FormEvent } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Trash2,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';

type ReportColumnType = 'text' | 'number' | 'boolean' | 'date';
type ReportMetricFunction = 'count' | 'sum' | 'average' | 'minimum' | 'maximum';
type ReportFilterOperator = 'equals' | 'contains' | 'greater_than' | 'at_least' | 'less_than' | 'at_most';
type ReportCell = string | number | boolean | null;

interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

interface ReportSource {
  key: string;
  label: string;
  columns: ReportColumn[];
}

interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value: string;
}

interface ReportMetric {
  function: ReportMetricFunction;
  field: string;
}

interface ReportDefinition {
  id: string;
  name: string;
  dataSource: string;
  columns: string[];
  filters?: ReportFilter[];
  groupBy: string | null;
  metrics?: ReportMetric[];
}

interface ReportRunResult {
  name: string;
  dataSource: string;
  columns: string[];
  totalElements: number;
  page: number;
  pageSize: number;
  rows: Array<Record<string, ReportCell>>;
}

export interface ReportBuilderProps {
  notify: (message: string) => void;
  role?: string;
}

type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface SavedReportSchedule {
  id: string;
  reportId: string;
  frequency: ScheduleFrequency;
  runAt: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string;
}

interface ScheduledReportRun {
  id: string;
  reportName: string;
  status: string;
  completedAt: string;
  errorMessage: string | null;
  result: { columns: string[]; rows: Array<Record<string, ReportCell>> } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isColumnType(value: unknown): value is ReportColumnType {
  return value === 'text' || value === 'number' || value === 'boolean' || value === 'date';
}
function isMetricFunction(value: string): value is ReportMetricFunction {
  return value === 'count' || value === 'sum' || value === 'average' || value === 'minimum' || value === 'maximum';
}
function isFilterOperator(value: string): value is ReportFilterOperator {
  return ['equals', 'contains', 'greater_than', 'at_least', 'less_than', 'at_most'].includes(value);
}
function isColumn(value: unknown): value is ReportColumn {
  return isRecord(value) && typeof value.key === 'string' && typeof value.label === 'string' && isColumnType(value.type);
}
function isSource(value: unknown): value is ReportSource {
  return isRecord(value) && typeof value.key === 'string' && typeof value.label === 'string' && Array.isArray(value.columns) && value.columns.every(isColumn);
}
function isFilter(value: unknown): value is ReportFilter {
  return isRecord(value) && typeof value.field === 'string' && typeof value.operator === 'string' && isFilterOperator(value.operator) && typeof value.value === 'string';
}
function isMetric(value: unknown): value is ReportMetric {
  return isRecord(value) && typeof value.function === 'string' && isMetricFunction(value.function) && typeof value.field === 'string';
}
function isDefinition(value: unknown): value is ReportDefinition {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.dataSource === 'string' &&
    Array.isArray(value.columns) &&
    value.columns.every((column) => typeof column === 'string') &&
    (value.filters === undefined || (Array.isArray(value.filters) && value.filters.every(isFilter))) &&
    (value.metrics === undefined || (Array.isArray(value.metrics) && value.metrics.every(isMetric))) &&
    (value.groupBy === null || typeof value.groupBy === 'string')
  );
}
function isCell(value: unknown): value is ReportCell {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
function isRunResult(value: unknown): value is ReportRunResult {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.dataSource === 'string' &&
    Array.isArray(value.columns) &&
    value.columns.every((column) => typeof column === 'string') &&
    typeof value.totalElements === 'number' &&
    typeof value.page === 'number' &&
    typeof value.pageSize === 'number' &&
    Array.isArray(value.rows) &&
    value.rows.every((row) => isRecord(row) && Object.values(row).every(isCell))
  );
}
function isSchedule(value: unknown): value is SavedReportSchedule {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.reportId === 'string' &&
    (value.frequency === 'DAILY' || value.frequency === 'WEEKLY' || value.frequency === 'MONTHLY') &&
    typeof value.runAt === 'string' &&
    typeof value.timezone === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.nextRunAt === 'string'
  );
}
function isScheduledRun(value: unknown): value is ScheduledReportRun {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.reportName !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.completedAt !== 'string' ||
    !(value.errorMessage === null || typeof value.errorMessage === 'string')
  ) {
    return false;
  }
  if (value.result === null) return true;
  return (
    isRecord(value.result) &&
    Array.isArray(value.result.columns) &&
    value.result.columns.every((column) => typeof column === 'string') &&
    Array.isArray(value.result.rows) &&
    value.result.rows.every((row) => isRecord(row) && Object.values(row).every(isCell))
  );
}
function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

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
    const [sourceResponse, definitionResponse] = await Promise.all([
      apiFetch(`${API}/report-builder/sources`),
      apiFetch(`${API}/report-builder/definitions`)
    ]);
    if (!sourceResponse.ok || !definitionResponse.ok) throw new Error('Could not load saved reports');
    const [sourcePayload, definitionPayload]: [unknown, unknown] = await Promise.all([
      sourceResponse.json(),
      definitionResponse.json()
    ]);
    if (!Array.isArray(sourcePayload) || !sourcePayload.every(isSource) || !Array.isArray(definitionPayload) || !definitionPayload.every(isDefinition)) {
      throw new Error('Invalid saved report response');
    }
    setSources(sourcePayload);
    setDefinitions(definitionPayload);
    if (sourcePayload.length) {
      const selected = sourcePayload.find((source) => source.key === sourceKey) || sourcePayload[0];
      setSourceKey(selected.key);
      if (!columns.length) setColumns(selected.columns.slice(0, 4).map((column) => column.key));
    }
  };

  useEffect(() => {
    void load().catch((error: unknown) => notify(messageFrom(error)));
  }, []);

  const selectedSource = sources.find((source) => source.key === sourceKey);
  const resultSource = sources.find((source) => source.key === result?.dataSource);

  const toggleColumn = (key: string): void =>
    setColumns((current) =>
      current.includes(key)
        ? current.filter((column) => column !== key)
        : current.length >= 12
        ? current
        : [...current, key]
    );

  const addFilter = (): void => {
    const first = selectedSource?.columns.find((column) => !filters.some((filter) => filter.field === column.key));
    if (first && filters.length < 8) {
      setFilters((current) => [
        ...current,
        {
          field: first.key,
          operator: first.type === 'text' ? 'contains' : 'equals',
          value: first.type === 'boolean' ? 'false' : ''
        }
      ]);
    }
  };

  const filterOperators = (type: ReportColumnType): Array<[ReportFilterOperator, string]> =>
    type === 'text'
      ? [
          ['equals', 'Equals'],
          ['contains', 'Contains']
        ]
      : type === 'boolean'
      ? [['equals', 'Equals']]
      : [
          ['equals', 'Equals'],
          ['greater_than', 'Greater than'],
          ['at_least', 'At least'],
          ['less_than', 'Less than'],
          ['at_most', 'At most']
        ];

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/report-builder/definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dataSource: sourceKey,
          columns,
          filters,
          groupBy: groupBy || null,
          metrics
        })
      });
      if (!response.ok) throw await responseError(response, 'Could not save report');
      const body: unknown = await response.json();
      const savedName = isRecord(body) && typeof body.name === 'string' ? body.name : name;
      setName('');
      await load();
      notify(`Saved report ${savedName}`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
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
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (definition: ReportDefinition): Promise<void> => {
    try {
      const response = await apiFetch(`${API}/report-builder/definitions/${definition.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete saved report');
      setDefinitions((current) => current.filter((row) => row.id !== definition.id));
      if (activeId === definition.id) {
        setActiveId('');
        setResult(null);
      }
      notify('Saved report deleted');
    } catch (error) {
      notify(messageFrom(error));
    }
  };

  const exportCsv = (): void => {
    if (!result) return;
    const quote = (value: ReportCell): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      result.columns
        .map((key) =>
          quote(
            key === 'groupValue'
              ? 'Group'
              : resultSource?.columns.find((column) => column.key === key)?.label || key.replaceAll('_', ' ')
          )
        )
        .join(','),
      ...result.rows.map((row) => result.columns.map((key) => quote(row[key] ?? null)).join(','))
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `spindl-${result.dataSource}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Master 2-Column Workbench: Schema Builder (Left) + Saved Reports (Right) */}
      <div className="reports-grid-2col">
        {/* Left Column: Custom Report Schema Builder */}
        <div className="reports-workbench-card">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sliders size={15} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Custom Report Schema Studio
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                  Design custom tenant-scoped reports from schema fields with aggregations and filters.
                </p>
              </div>
            </div>
            <span className="audit-tag" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {columns.length} Fields Selected
            </span>
          </div>

          <form onSubmit={(e) => void save(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Step 1: Report Name & Data Source Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
              <div className="audit-filter-field">
                <label>Report Name</label>
                <input
                  value={name}
                  maxLength={120}
                  required
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Active Customer Directory"
                />
              </div>

              <div className="audit-filter-field">
                <label>Data Source</label>
                <select
                  value={sourceKey}
                  onChange={(e) => {
                    const next = sources.find((source) => source.key === e.target.value);
                    setSourceKey(e.target.value);
                    setColumns(next?.columns.slice(0, 4).map((column) => column.key) || []);
                    setFilters([]);
                    setGroupBy('');
                    setMetrics([]);
                    setResult(null);
                  }}
                >
                  {sources.map((source) => (
                    <option key={source.key} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: Interactive Field Projection Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Select Visible Columns (Max 12)
                </label>
                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                  Click to toggle column visibility
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedSource?.columns.map((column) => {
                  const isActive = columns.includes(column.key);
                  return (
                    <button
                      key={column.key}
                      type="button"
                      className={`reports-field-chip ${isActive ? 'active' : ''}`}
                      onClick={() => toggleColumn(column.key)}
                    >
                      <Check size={11} style={{ opacity: isActive ? 1 : 0.2 }} />
                      <span>{column.label}</span>
                      <span style={{ fontSize: '10px', color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                        {column.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Grouping & Aggregations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Grouping & Aggregations
                </span>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  style={{ height: '24px', fontSize: '11px' }}
                  disabled={!groupBy || metrics.length >= 4 || !selectedSource?.columns.some((c) => c.type === 'number')}
                  onClick={() => {
                    const field = selectedSource?.columns.find((c) => c.type === 'number' && !metrics.some((m) => m.field === c.key))?.key || '*';
                    setMetrics((current) => (current.length < 4 ? [...current, { function: 'sum', field }] : current));
                  }}
                >
                  <Plus size={11} />
                  <span>Add Metric</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <div className="audit-filter-field">
                  <label>Group Rows By</label>
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    <option value="">No grouping (Flat records)</option>
                    {selectedSource?.columns.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </div>

                {metrics.map((metric, index) => (
                  <div key={`metric-${index}`} className="reports-filter-rule-row">
                    <div className="audit-filter-field">
                      <label>Calculation</label>
                      <select
                        value={metric.function}
                        onChange={(e) => {
                          const func = e.target.value;
                          if (!isMetricFunction(func)) return;
                          setMetrics((current) =>
                            current.map((row, rIndex) =>
                              rIndex === index
                                ? {
                                    ...row,
                                    function: func,
                                    field:
                                      func === 'count'
                                        ? '*'
                                        : row.field === '*'
                                        ? selectedSource?.columns.find((c) => c.type === 'number')?.key || ''
                                        : row.field
                                  }
                                : row
                            )
                          );
                        }}
                      >
                        <option value="count">Count</option>
                        <option value="sum">Sum</option>
                        <option value="average">Average</option>
                        <option value="minimum">Minimum</option>
                        <option value="maximum">Maximum</option>
                      </select>
                    </div>

                    <div className="audit-filter-field">
                      <label>Target Field</label>
                      {metric.function === 'count' ? (
                        <select
                          value={metric.field}
                          onChange={(e) =>
                            setMetrics((curr) =>
                              curr.map((r, ri) => (ri === index ? { ...r, field: e.target.value } : r))
                            )
                          }
                        >
                          <option value="*">All Rows</option>
                          {selectedSource?.columns.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={metric.field}
                          onChange={(e) =>
                            setMetrics((curr) =>
                              curr.map((r, ri) => (ri === index ? { ...r, field: e.target.value } : r))
                            )
                          }
                        >
                          {selectedSource?.columns
                            .filter((c) => c.type === 'number')
                            .map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        onClick={() => setMetrics((current) => current.filter((_, ri) => ri !== index))}
                        title="Remove calculation"
                        style={{ height: '30px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Granular Filter Rules */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Filter Rules ({filters.length})
                </span>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  style={{ height: '24px', fontSize: '11px' }}
                  disabled={filters.length >= 8 || !selectedSource}
                  onClick={addFilter}
                >
                  <Plus size={11} />
                  <span>Add Filter Rule</span>
                </button>
              </div>

              {filters.length === 0 ? (
                <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  No filter rules configured. All records in data source will be included.
                </span>
              ) : (
                filters.map((filter, index) => {
                  const meta = selectedSource?.columns.find((column) => column.key === filter.field);
                  const type = meta?.type || 'text';
                  return (
                    <div key={index} className="reports-filter-rule-row">
                      <div className="audit-filter-field">
                        <label>Field</label>
                        <select
                          value={filter.field}
                          onChange={(e) => {
                            const field = e.target.value;
                            const nextType = selectedSource?.columns.find((c) => c.key === field)?.type || 'text';
                            const operator: ReportFilterOperator = nextType === 'text' ? 'contains' : 'equals';
                            setFilters((curr) =>
                              curr.map((r, ri) =>
                                ri === index
                                  ? { ...r, field, operator, value: nextType === 'boolean' ? 'false' : '' }
                                  : r
                              )
                            );
                          }}
                        >
                          {selectedSource?.columns.map((column) => (
                            <option key={column.key} value={column.key}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="audit-filter-field">
                        <label>Condition</label>
                        <select
                          value={filter.operator}
                          onChange={(e) => {
                            const operator = e.target.value;
                            if (isFilterOperator(operator)) {
                              setFilters((curr) =>
                                curr.map((r, ri) => (ri === index ? { ...r, operator } : r))
                              );
                            }
                          }}
                        >
                          {filterOperators(type).map(([val, lbl]) => (
                            <option key={val} value={val}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="audit-filter-field">
                        <label>Value</label>
                        {type === 'boolean' ? (
                          <select
                            value={filter.value}
                            onChange={(e) =>
                              setFilters((curr) =>
                                curr.map((r, ri) => (ri === index ? { ...r, value: e.target.value } : r))
                              )
                            }
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <input
                            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                            step={type === 'number' ? 'any' : undefined}
                            value={filter.value}
                            onChange={(e) =>
                              setFilters((curr) =>
                                curr.map((r, ri) => (ri === index ? { ...r, value: e.target.value } : r))
                              )
                            }
                            placeholder={type === 'text' ? 'Match criteria…' : undefined}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          onClick={() => setFilters((curr) => curr.filter((_, ri) => ri !== index))}
                          title="Remove filter"
                          style={{ height: '30px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="submit"
                className="button button-primary"
                disabled={
                  saving ||
                  !name.trim() ||
                  !columns.length ||
                  filters.some((filter) => !String(filter.value).trim()) ||
                  !canManage
                }
                style={{ height: '32px', fontSize: '12px', padding: '0 16px' }}
              >
                <span>{saving ? 'Saving Schema…' : 'Save Custom Report'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Saved Custom Reports Directory */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <FileSpreadsheet size={15} style={{ color: 'var(--sp-text-secondary)' }} />
              <span>Saved Custom Reports</span>
            </h4>
            <span className="audit-tag">{definitions.length}</span>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
            Execute saved report definitions on demand or export up to 100 matching rows.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
            {definitions.length === 0 ? (
              <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                No custom reports saved yet. Configure a report schema on the left to begin.
              </div>
            ) : (
              definitions.map((def) => {
                const srcLabel = sources.find((s) => s.key === def.dataSource)?.label || def.dataSource;
                const isRunning = loading && activeId === def.id;

                return (
                  <div key={def.id} className="reports-saved-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <strong style={{ fontSize: '12.5px', color: 'var(--sp-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {def.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {srcLabel} · {def.columns.length} columns · {def.filters?.length || 0} filters
                        {def.groupBy ? ` · grouped by ${def.groupBy}` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        disabled={loading}
                        onClick={() => void run(def)}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        <Play size={11} className={isRunning ? 'spin' : ''} />
                        <span>{isRunning ? 'Running…' : 'Run'}</span>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          disabled={loading}
                          onClick={() => void remove(def)}
                          title="Delete saved report"
                          style={{ height: '26px', padding: '0 6px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. Execution Results Workbench (Visible when result loaded) */}
      {result && (
        <div className="reports-workbench-card" style={{ gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                {result.name}
              </h4>
              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                {result.totalElements.toLocaleString()} matching records · showing first {result.rows.length} rows
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box" style={{ width: '220px' }}>
                <Search size={13} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  value={search}
                  placeholder="Filter records…"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={loading}
                onClick={() => {
                  const def = definitions.find((item) => item.id === activeId);
                  if (def) void run(def);
                }}
                style={{ height: '28px', fontSize: '11.5px' }}
              >
                <span>Search</span>
              </button>

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={exportCsv}
                style={{ height: '28px', fontSize: '11.5px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="reports-table-panel">
            <div className="table-scroll" style={{ margin: 0 }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    {result.columns.map((key) => (
                      <th key={key}>
                        {key === 'groupValue'
                          ? 'Group'
                          : resultSource?.columns.find((column) => column.key === key)?.label || key.replaceAll('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={result.columns.length} className="empty-cell" style={{ padding: '32px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <RefreshCw size={18} className="spin" style={{ color: 'var(--sp-text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                            Running report query…
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length} className="empty-cell">
                        No rows match this query.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, index) => (
                      <tr key={index}>
                        {result.columns.map((key) => (
                          <td key={key}>
                            {row[key] === true ? (
                              <span className="status status-green"><i aria-hidden="true" /> Yes</span>
                            ) : row[key] === false ? (
                              <span className="status status-amber"><i aria-hidden="true" /> No</span>
                            ) : (
                              row[key] ?? '—'
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
    const [reportResponse, scheduleResponse] = await Promise.all([
      apiFetch(`${API}/report-builder/definitions`),
      apiFetch(path)
    ]);
    if (!reportResponse.ok || !scheduleResponse.ok) throw new Error('Could not load report schedules');
    const [reportPayload, schedulePayload]: [unknown, unknown] = await Promise.all([
      reportResponse.json(),
      scheduleResponse.json()
    ]);
    if (!Array.isArray(reportPayload) || !reportPayload.every(isDefinition) || !Array.isArray(schedulePayload) || !schedulePayload.every(isSchedule)) {
      throw new Error('Invalid report schedule response');
    }
    setReports(reportPayload);
    setSchedules(schedulePayload);
    if (!reportId && reportPayload.length) setReportId(reportPayload[0].id);
  };

  useEffect(() => {
    if (canManage) void load().catch((error: unknown) => notify(messageFrom(error)));
  }, [canManage]);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        reportId,
        frequency,
        runAt: `${runAt}:00`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        weekDay: frequency === 'WEEKLY' ? Number(weekDay) : null,
        monthDay: frequency === 'MONTHLY' ? Number(monthDay) : null
      };
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw await responseError(response, 'Could not schedule report');
      await response.json();
      await load();
      notify('Report schedule created');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const disable = async (schedule: SavedReportSchedule): Promise<void> => {
    try {
      const response = await apiFetch(`${path}/${schedule.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disable report schedule');
      await load();
      if (activeSchedule === schedule.id) {
        setActiveSchedule('');
        setRuns([]);
      }
      notify('Report schedule disabled');
    } catch (error) {
      notify(messageFrom(error));
    }
  };

  const showRuns = async (schedule: SavedReportSchedule): Promise<void> => {
    try {
      const response = await apiFetch(`${path}/${schedule.id}/runs`);
      const payload: unknown = await response.json().catch(() => []);
      if (!response.ok) throw new Error('Could not load scheduled report runs');
      if (!Array.isArray(payload) || !payload.every(isScheduledRun)) {
        throw new Error('Invalid scheduled report runs response');
      }
      setRuns(payload);
      setActiveSchedule(schedule.id);
    } catch (error) {
      notify(messageFrom(error));
    }
  };

  const download = (run: ScheduledReportRun): void => {
    const cols = run.result?.columns || [];
    const rows = run.result?.rows || [];
    const quote = (value: ReportCell): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      cols.map(quote).join(','),
      ...rows.map((row) => cols.map((column) => quote(row[column] ?? null)).join(','))
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spindl-scheduled-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canManage) {
    return (
      <div className="reports-workbench-card">
        <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
          Only workspace managers and administrators can configure automated report schedules.
        </span>
      </div>
    );
  }

  return (
    <div className="reports-grid-2col">
      {/* Left: New Schedule Creator */}
      <div className="reports-workbench-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={15} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
              New Automated Report Schedule
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
              Save a recurring report run in this workspace. Each run archives up to 100 rows for download.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void create(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="audit-filter-field">
            <label>Saved Report</label>
            <select required value={reportId} onChange={(e) => setReportId(e.target.value)}>
              <option value="">Choose a report</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Frequency
            </label>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${frequency === 'DAILY' ? 'active' : ''}`}
                onClick={() => setFrequency('DAILY')}
              >
                Daily
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${frequency === 'WEEKLY' ? 'active' : ''}`}
                onClick={() => setFrequency('WEEKLY')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${frequency === 'MONTHLY' ? 'active' : ''}`}
                onClick={() => setFrequency('MONTHLY')}
              >
                Monthly
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {frequency === 'WEEKLY' && (
              <div className="audit-filter-field">
                <label>Day of Week</label>
                <select value={weekDay} onChange={(e) => setWeekDay(e.target.value)}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {frequency === 'MONTHLY' && (
              <div className="audit-filter-field">
                <label>Day of Month</label>
                <select value={monthDay} onChange={(e) => setMonthDay(e.target.value)}>
                  {Array.from({ length: 28 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Day {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="audit-filter-field" style={{ gridColumn: frequency === 'DAILY' ? '1 / -1' : undefined }}>
              <label>Run Time (Local)</label>
              <input type="time" required value={runAt} onChange={(e) => setRunAt(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={saving || !reportId}
              style={{ height: '32px', fontSize: '12px', padding: '0 16px' }}
            >
              <span>{saving ? 'Creating Schedule…' : 'Schedule Report'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Right: Active Schedules & Recent Runs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Active Schedules */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Active Workspace Schedules
            </h4>
            <span className="audit-tag">{schedules.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {schedules.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                No automated report schedules configured.
              </div>
            ) : (
              schedules.map((schedule) => {
                const repName = reports.find((r) => r.id === schedule.reportId)?.name || 'Saved Report';
                const isSelected = activeSchedule === schedule.id;

                return (
                  <div key={schedule.id} className="reports-saved-card" style={{ borderColor: isSelected ? 'var(--sp-brand)' : undefined }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>{repName}</strong>
                        <span className={`audit-tag ${schedule.enabled ? '' : 'danger'}`}>
                          {schedule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {schedule.frequency.toLowerCase()} at {schedule.runAt.slice(0, 5)} · Next run {new Date(schedule.nextRunAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        onClick={() => void showRuns(schedule)}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        <span>History</span>
                      </button>
                      {schedule.enabled && (
                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          onClick={() => void disable(schedule)}
                          style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                        >
                          <span>Disable</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Execution History */}
        {activeSchedule && (
          <div className="reports-workbench-card">
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Recent Execution History
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {runs.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                  No historical runs recorded for this schedule.
                </div>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="reports-saved-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--sp-text)' }}>{run.reportName}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {new Date(run.completedAt).toLocaleString()} · {run.status}
                      </span>
                    </div>
                    {run.status === 'COMPLETED' && (
                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        onClick={() => download(run)}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        <Download size={11} />
                        <span>CSV</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
