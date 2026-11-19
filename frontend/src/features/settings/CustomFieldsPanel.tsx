import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Send,
  Sliders,
  Sparkles,
  Tag,
  Upload,
  UserCheck,
  Users
} from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';

export type CustomFieldResource =
  | 'customers'
  | 'items'
  | 'suppliers'
  | 'purchase_orders'
  | 'quotes'
  | 'sales_orders'
  | 'invoices'
  | 'work_orders';

type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'REFERENCE';

interface CustomFieldValidation {
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
}

interface CustomFieldDefinition {
  id: string;
  fieldKey: string;
  displayName: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  validation: CustomFieldValidation;
  defaultValue: unknown;
  published: boolean;
}

interface CustomFieldImportPreview {
  totalRows: number;
  validRows: number;
  customFieldCount: number;
  errors: Array<{ row: number; message: string }>;
  sampleRows: Array<Record<string, string>>;
}

interface ApiErrorBody {
  detail?: string;
  message?: string;
}

interface CustomFieldImportCommit {
  imported: boolean;
  rowsImported: number;
  errors: Array<{ row: number; message: string }>;
}

interface CustomFieldsPanelProps {
  role?: string;
  notify: (message: string) => void;
}

const RESOURCE_TABS: Array<{ id: CustomFieldResource; label: string }> = [
  { id: 'customers', label: 'Customers' },
  { id: 'items', label: 'Items & Products' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'quotes', label: 'Quotations' },
  { id: 'sales_orders', label: 'Sales Orders' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'work_orders', label: 'Work Orders' }
];

function isCustomFieldResource(value: string): value is CustomFieldResource {
  return [
    'customers',
    'items',
    'suppliers',
    'purchase_orders',
    'quotes',
    'sales_orders',
    'invoices',
    'work_orders'
  ].includes(value);
}

function isCustomFieldType(value: string): value is CustomFieldType {
  return (
    value === 'TEXT' ||
    value === 'NUMBER' ||
    value === 'DATE' ||
    value === 'BOOLEAN' ||
    value === 'SELECT' ||
    value === 'REFERENCE'
  );
}

export function CustomFieldsPanel({ role, notify }: CustomFieldsPanelProps) {
  const [resource, setResource] = useState<CustomFieldResource>('customers');
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT');
  const [showAddForm, setShowAddForm] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CustomFieldImportPreview | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvKey, setCsvKey] = useState('');

  const canEdit = role !== undefined && ['OWNER', 'ADMIN'].includes(role);

  const refresh = (): Promise<void> =>
    apiFetch(`${API}/custom-fields?resource=${resource}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Could not load custom fields'))
      )
      .then((rows: CustomFieldDefinition[]) => setFields(rows))
      .catch((error: unknown) =>
        notify(error instanceof Error ? error.message : String(error))
      );

  useEffect(() => {
    refresh();
  }, [resource]);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const options =
      fieldType === 'SELECT'
        ? String(form.get('options') || '')
            .split(/[,\n]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    const validation: CustomFieldValidation = {};
    if (fieldType === 'TEXT') {
      if (form.get('minLength')) validation.minLength = Number(form.get('minLength'));
      if (form.get('maxLength')) validation.maxLength = Number(form.get('maxLength'));
    }
    if (fieldType === 'NUMBER') {
      if (form.get('min')) validation.min = Number(form.get('min'));
      if (form.get('max')) validation.max = Number(form.get('max'));
    }
    const rawDefaultValue = form.get('defaultValue');
    let defaultValue: string | number | boolean | null =
      typeof rawDefaultValue === 'string' && rawDefaultValue ? rawDefaultValue : null;
    if (defaultValue !== null && fieldType === 'NUMBER') defaultValue = Number(defaultValue);
    if (defaultValue !== null && fieldType === 'BOOLEAN') defaultValue = defaultValue === 'true';

    try {
      const response = await apiFetch(`${API}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceCode: resource,
          fieldKey: form.get('fieldKey'),
          displayName: form.get('displayName'),
          fieldType,
          required: form.get('required') === 'on',
          options,
          validation,
          defaultValue
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || 'Could not create custom field');
      await refresh();
      setShowAddForm(false);
      notify('Custom field created as a draft. Publish it to activate it on production records.');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/custom-fields/${id}/publish`, {
        method: 'POST'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || 'Could not publish custom field');
      await refresh();
      notify(`${body.displayName} is now published and active on ${resource.replaceAll('_', ' ')} records`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const previewCsv = async (): Promise<void> => {
    if (!csvFile) return;
    setCsvBusy(true);
    try {
      const form = new FormData();
      form.append('file', csvFile);
      const response = await apiFetch(`${API}/custom-fields/${resource}/import/preview`, {
        method: 'POST',
        body: form
      });
      const body: CustomFieldImportPreview & ApiErrorBody = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || 'Could not validate custom-field CSV');
      setCsvPreview(body);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setCsvBusy(false);
    }
  };

  const commitCsv = async (): Promise<void> => {
    if (!csvFile || !csvPreview || csvPreview.errors.length) return;
    setCsvBusy(true);
    try {
      const form = new FormData();
      form.append('file', csvFile);
      const response = await apiFetch(`${API}/custom-fields/${resource}/import/commit`, {
        method: 'POST',
        headers: { 'Idempotency-Key': csvKey },
        body: form
      });
      const body: CustomFieldImportCommit & ApiErrorBody = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || 'Could not import custom-field values');
      if (!body.imported) {
        setCsvPreview((cur) => (cur ? { ...cur, errors: body.errors || [] } : cur));
        notify('Resolve the row errors before importing');
        return;
      }
      setCsvPreview(null);
      setCsvFile(null);
      setCsvKey('');
      notify(`${body.rowsImported} ${resource.replaceAll('_', ' ')} record(s) updated`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setCsvBusy(false);
    }
  };

  const downloadCsvErrors = (): void => {
    if (!csvPreview?.errors?.length) return;
    const cell = (val: string | number) => {
      let text = String(val ?? '');
      if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [
      'row,error',
      ...csvPreview.errors.map((err) => `${cell(err.row)},${cell(err.message)}`)
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `spindl-${resource}-custom-field-import-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">Custom fields schema</h2>
          <p className="sales-card-subtitle">
            Define strongly-typed custom metadata fields for business entities. Published fields are validated server-side and automatically indexed.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="sales-action-btn primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={13} />
            <span>{showAddForm ? 'Close form' : 'Add custom field'}</span>
          </button>
        )}
      </div>

      {/* 1. Linear Resource Tabs */}
      <nav className="custom-fields-resource-nav" aria-label="Select record type">
        {RESOURCE_TABS.map((tab) => {
          const isActive = resource === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`custom-fields-resource-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setResource(tab.id);
                setCsvPreview(null);
                setCsvKey('');
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '0 5px',
                    borderRadius: '9999px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: 'var(--sp-brand, #8b5cf6)',
                    fontWeight: 600
                  }}
                >
                  {fields.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 2. Add Custom Field Form (Collapsible) */}
      {showAddForm && canEdit && (
        <form
          className="integration-form-card"
          onSubmit={create}
          style={{ animation: 'leadSlideDown 150ms ease-out' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Add draft field for {RESOURCE_TABS.find((t) => t.id === resource)?.label}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Drafts remain unpublished until verified
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              alignItems: 'end'
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
              Field key *
              <input
                name="fieldKey"
                required
                maxLength={40}
                pattern="[a-z][a-z0-9_]*"
                placeholder="e.g. tier_category"
                style={{ height: '32px', borderRadius: '6px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
              Display name *
              <input
                name="displayName"
                required
                maxLength={100}
                placeholder="e.g. Tier Category"
                style={{ height: '32px', borderRadius: '6px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
              Data type *
              <select
                value={fieldType}
                onChange={(e) => {
                  if (isCustomFieldType(e.target.value)) setFieldType(e.target.value);
                }}
                style={{ height: '32px', borderRadius: '6px' }}
              >
                {['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'REFERENCE'].map((t) => (
                  <option key={t} value={t}>
                    {t.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            {fieldType === 'SELECT' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
                Select options (comma separated) *
                <input
                  name="options"
                  required
                  placeholder="Platinum, Gold, Silver"
                  style={{ height: '32px', borderRadius: '6px' }}
                />
              </label>
            )}

            {fieldType === 'TEXT' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
                  Min length
                  <input name="minLength" type="number" min="0" style={{ height: '32px', borderRadius: '6px' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
                  Max length
                  <input name="maxLength" type="number" min="1" max="10000" style={{ height: '32px', borderRadius: '6px' }} />
                </label>
              </>
            )}

            {fieldType === 'NUMBER' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
                  Min value
                  <input name="min" type="number" step="any" style={{ height: '32px', borderRadius: '6px' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
                  Max value
                  <input name="max" type="number" step="any" style={{ height: '32px', borderRadius: '6px' }} />
                </label>
              </>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: 'var(--sp-text-muted)', fontWeight: 500 }}>
              Default value
              <input
                name="defaultValue"
                type={fieldType === 'DATE' ? 'date' : fieldType === 'NUMBER' ? 'number' : 'text'}
                step={fieldType === 'NUMBER' ? 'any' : undefined}
                style={{ height: '32px', borderRadius: '6px' }}
              />
            </label>

            <div style={{ paddingBottom: '6px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--sp-text)'
                }}
              >
                <input
                  name="required"
                  type="checkbox"
                  style={{ width: '15px', height: '15px', accentColor: 'var(--sp-brand, #8b5cf6)' }}
                />
                Required on records
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--sp-border-subtle)', paddingTop: '12px' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add draft field'}
            </button>
          </div>
        </form>
      )}

      {/* 3. Fields Table */}
      <div style={{ marginTop: '8px' }}>
        {fields.length === 0 ? (
          <div
            className="panel production-empty"
            style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--sp-border)' }}
          >
            <Tag size={20} style={{ color: 'var(--sp-text-subtle)', marginBottom: '6px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-muted)' }}>
              No custom fields configured for {RESOURCE_TABS.find((t) => t.id === resource)?.label}. Click "Add custom field" to create one.
            </p>
          </div>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>FIELD NAME</th>
                  <th style={{ width: '20%' }}>FIELD KEY</th>
                  <th style={{ width: '16%' }}>DATA TYPE</th>
                  <th style={{ width: '16%' }}>REQUIREMENT</th>
                  <th style={{ width: '12%' }}>STATUS</th>
                  {canEdit && <th style={{ width: '12%', textAlign: 'right' }}>ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td>
                      <b style={{ color: 'var(--sp-text)' }}>{field.displayName}</b>
                    </td>
                    <td>
                      <code className="settings-code-chip">{field.fieldKey}</code>
                    </td>
                    <td>
                      <span className="module-state">
                        {field.fieldType.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11.5px', color: field.required ? 'var(--sp-brand)' : 'var(--sp-text-muted)', fontWeight: field.required ? 600 : 400 }}>
                        {field.required ? 'Mandatory' : 'Optional'}
                      </span>
                    </td>
                    <td>
                      <span className={`module-state ${field.published ? 'enabled' : ''}`}>
                        {field.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        {!field.published && (
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                            disabled={saving}
                            onClick={() => publish(field.id)}
                          >
                            Publish
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Bulk CSV Import Card */}
      <div className="integration-form-card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={16} color="var(--sp-brand, #8b5cf6)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Bulk import values for existing {RESOURCE_TABS.find((t) => t.id === resource)?.label}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              CSV requires an <code>id</code> column matching record IDs in this workspace and columns matching published field keys. Maximum 500 rows.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ fontSize: '12px', color: 'var(--sp-text)' }}
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setCsvFile(next);
                setCsvPreview(null);
                setCsvKey(next ? crypto.randomUUID() : '');
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <button
              type="button"
              className="button button-secondary"
              disabled={!csvFile || csvBusy}
              onClick={previewCsv}
              style={{ height: '32px' }}
            >
              {csvBusy ? 'Checking…' : 'Preview values'}
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!csvPreview || csvPreview.errors.length > 0 || csvBusy}
              onClick={commitCsv}
              style={{ height: '32px' }}
            >
              {csvBusy ? 'Importing…' : 'Import values'}
            </button>
          </div>
        </div>

        {csvPreview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: csvPreview.errors.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                border: `1px solid ${csvPreview.errors.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
                {csvPreview.validRows} of {csvPreview.totalRows} rows valid · {csvPreview.customFieldCount} custom field(s) matched
              </span>
              {csvPreview.errors.length > 0 && (
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                  onClick={downloadCsvErrors}
                >
                  <Download size={12} /> Download error CSV
                </button>
              )}
            </div>

            {csvPreview.errors.length > 0 && (
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--sp-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'var(--sp-surface-subtle)'
                }}
              >
                {csvPreview.errors.map((error, idx) => (
                  <div key={`${error.row}-${idx}`} style={{ fontSize: '11px', color: 'var(--sp-error)' }}>
                    <b>Row {error.row}:</b> {error.message}
                  </div>
                ))}
              </div>
            )}

            {csvPreview.sampleRows?.length > 0 && (
              <div className="integration-table-wrap">
                <table className="integration-table">
                  <thead>
                    <tr>
                      {Object.keys(csvPreview.sampleRows[0]).map((header) => (
                        <th key={header}>{header.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.sampleRows.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(csvPreview.sampleRows[0]).map((header) => (
                          <td key={header}>{row[header]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="form-note">Only workspace owners and admins can configure custom fields.</p>
      )}
    </section>
  );
}
