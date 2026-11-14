import { useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';

type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'REFERENCE';
type CustomFieldValue = string | number | boolean | null;
type CustomFieldValues = Record<string, CustomFieldValue>;
type UnknownRecord = Record<string, unknown>;

interface CustomFieldDefinition {
  id: string;
  fieldKey: string;
  displayName: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  validation: {
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
  };
  defaultValue?: CustomFieldValue;
  published: boolean;
}

interface CustomFieldEditorProps {
  resource: string;
  recordId: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not load or save custom field values';
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldValue(value: unknown, fallback: CustomFieldValue = null): CustomFieldValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : fallback;
}

function apiError(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.detail === 'string' ? value.detail : typeof value.message === 'string' ? value.message : undefined;
}

function isCustomFieldDefinition(value: unknown): value is CustomFieldDefinition {
  if (!isRecord(value)) return false;
  const validation = value.validation;
  return typeof value.id === 'string'
    && typeof value.fieldKey === 'string'
    && typeof value.displayName === 'string'
    && ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'REFERENCE'].includes(String(value.fieldType))
    && typeof value.required === 'boolean'
    && Array.isArray(value.options)
    && value.options.every((option) => typeof option === 'string')
    && isRecord(validation)
    && typeof value.published === 'boolean';
}

export function CustomFieldEditor({ resource, recordId }: CustomFieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [values, setValues] = useState<CustomFieldValues>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [fieldResponse, valueResponse] = await Promise.all([
        apiFetch(`${API}/custom-fields?resource=${resource}`),
        apiFetch(`${API}/custom-fields/${resource}/${recordId}`),
      ]);
      const [fieldPayload, valuePayload]: [unknown, unknown] = await Promise.all([
        fieldResponse.json().catch(() => []),
        valueResponse.json().catch(() => ({})),
      ]);
      if (!fieldResponse.ok || !valueResponse.ok) throw new Error(apiError(fieldPayload) ?? apiError(valuePayload) ?? 'Could not load custom fields');
      if (!Array.isArray(fieldPayload) || !fieldPayload.every(isCustomFieldDefinition) || !isRecord(valuePayload)) {
        throw new Error('The server returned invalid custom-field data');
      }
      const published = fieldPayload.filter((field) => field.published);
      setFields(published);
      setValues(Object.fromEntries(published.map((field) => [field.fieldKey, fieldValue(valuePayload[field.fieldKey], fieldValue(field.defaultValue, ''))])));
      if (!published.length) setError('No published custom fields are configured for this record type.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined));
      const response = await apiFetch(`${API}/custom-fields/${resource}/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: payload }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body) ?? 'Could not save custom field values');
      if (!isRecord(body)) throw new Error('The server returned invalid custom-field data');
      setValues(Object.fromEntries(fields.map((field) => [field.fieldKey, fieldValue(body[field.fieldKey], '')])));
      setOpen(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const editValue = (field: CustomFieldDefinition, raw: string) => {
    const value: CustomFieldValue = field.fieldType === 'NUMBER' && raw !== ''
      ? Number(raw)
      : field.fieldType === 'BOOLEAN' && raw !== ''
        ? raw === 'true'
        : raw;
    setValues((current) => ({ ...current, [field.fieldKey]: value }));
  };

  return <>
    <button type="button" className="mini-action muted" onClick={() => { setOpen(true); void load(); }}>Custom fields</button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <form className="record-modal" onSubmit={save}>
        <div className="modal-title"><div><h2>Additional details</h2><p>Update workspace-defined fields for this record.</p></div><button type="button" disabled={saving} onClick={() => setOpen(false)}>×</button></div>
        {loading ? <p className="form-note">Loading fields…</p> : fields.map((field) => {
          const value = values[field.fieldKey] ?? '';
          return <label key={field.id}>{field.displayName}
            {field.fieldType === 'SELECT'
              ? <select value={String(value)} required={field.required} onChange={(event) => editValue(field, event.target.value)}><option value="">Choose {field.displayName.toLowerCase()}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : field.fieldType === 'BOOLEAN'
                ? <select value={value === '' ? '' : String(value)} required={field.required} onChange={(event) => editValue(field, event.target.value)}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select>
                : <input type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'} step={field.fieldType === 'NUMBER' ? 'any' : undefined} value={String(value)} required={field.required} maxLength={field.fieldType === 'TEXT' ? field.validation.maxLength : undefined} minLength={field.fieldType === 'TEXT' ? field.validation.minLength : undefined} min={field.fieldType === 'NUMBER' ? field.validation.min : undefined} max={field.fieldType === 'NUMBER' ? field.validation.max : undefined} placeholder={field.fieldType === 'REFERENCE' ? 'Record UUID' : undefined} onChange={(event) => editValue(field, event.target.value)} />}
          </label>;
        })}
        {error && <p className="form-note">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => setOpen(false)}>Close</button>{fields.length > 0 && <button className="button button-primary" disabled={saving || loading}>{saving ? 'Saving…' : 'Save details'}</button>}</div>
      </form>
    </div>}
  </>;
}
