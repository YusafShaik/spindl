import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  FileText,
  History,
  Palette,
  RotateCcw,
  Save,
  Send,
  Sparkles
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

type InvoiceField =
  | 'invoiceNumber'
  | 'issueDate'
  | 'dueDate'
  | 'customerName'
  | 'customerEmail'
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'amountPaid'
  | 'balance';

interface InvoiceTemplateConfig {
  documentType: 'INVOICE';
  title: string;
  footer: string;
  locale: 'en-IN' | 'en-US';
  accentColor: string;
  fields: InvoiceField[];
}

interface InvoiceTemplateVersion {
  id: string;
  version: number;
  status: string;
  configuration: InvoiceTemplateConfig;
}

interface InvoiceTemplateView {
  key: string;
  published: InvoiceTemplateVersion | null;
  draft: InvoiceTemplateVersion | null;
  history: InvoiceTemplateVersion[];
}

interface InvoicePreviewField {
  key: InvoiceField;
  label: string;
  sampleValue: string;
}

interface InvoiceTemplatePreview {
  version: InvoiceTemplateVersion;
  fields: InvoicePreviewField[];
}

interface InvoiceTemplateValidation {
  valid: boolean;
  checks: string[];
  preview: InvoiceTemplatePreview;
}

const fieldLabels: Record<InvoiceField, string> = {
  invoiceNumber: 'Invoice Number',
  issueDate: 'Issue Date',
  dueDate: 'Due Date',
  customerName: 'Customer Name',
  customerEmail: 'Customer Email',
  subtotal: 'Subtotal',
  tax: 'Tax Breakdown',
  total: 'Total Due',
  amountPaid: 'Amount Paid',
  balance: 'Remaining Balance'
};

const invoiceFields: InvoiceField[] = [
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'customerName',
  'customerEmail',
  'subtotal',
  'tax',
  'total',
  'amountPaid',
  'balance'
];

const sampleFieldValues: Record<InvoiceField, string> = {
  invoiceNumber: 'INV-2026-0891',
  issueDate: '21 Nov 2026',
  dueDate: '05 Dec 2026',
  customerName: 'Acme Technologies Ltd.',
  customerEmail: 'billing@acme-tech.com',
  subtotal: '₹ 1,20,000.00',
  tax: '₹ 21,600.00 (18% GST)',
  total: '₹ 1,41,600.00',
  amountPaid: '₹ 41,600.00',
  balance: '₹ 1,00,000.00'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInvoiceField(value: unknown): value is InvoiceField {
  return typeof value === 'string' && Object.hasOwn(fieldLabels, value);
}

function isConfig(value: unknown): value is InvoiceTemplateConfig {
  return (
    isRecord(value) &&
    value.documentType === 'INVOICE' &&
    typeof value.title === 'string' &&
    typeof value.footer === 'string' &&
    (value.locale === 'en-IN' || value.locale === 'en-US') &&
    typeof value.accentColor === 'string' &&
    Array.isArray(value.fields) &&
    value.fields.every(isInvoiceField)
  );
}

function isVersion(value: unknown): value is InvoiceTemplateVersion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.version === 'number' &&
    typeof value.status === 'string' &&
    isConfig(value.configuration)
  );
}

function isView(value: unknown): value is InvoiceTemplateView {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    (value.published === null || isVersion(value.published)) &&
    (value.draft === null || isVersion(value.draft)) &&
    Array.isArray(value.history) &&
    value.history.every(isVersion)
  );
}

function isPreviewField(value: unknown): value is InvoicePreviewField {
  return (
    isRecord(value) &&
    isInvoiceField(value.key) &&
    typeof value.label === 'string' &&
    typeof value.sampleValue === 'string'
  );
}

function isPreview(value: unknown): value is InvoiceTemplatePreview {
  return (
    isRecord(value) &&
    isVersion(value.version) &&
    Array.isArray(value.fields) &&
    value.fields.every(isPreviewField)
  );
}

function isValidation(value: unknown): value is InvoiceTemplateValidation {
  return (
    isRecord(value) &&
    typeof value.valid === 'boolean' &&
    Array.isArray(value.checks) &&
    value.checks.every((check) => typeof check === 'string') &&
    isPreview(value.preview)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function InvoiceTemplateDesigner({
  notify,
  role
}: {
  notify: (message: string) => void;
  role?: string;
}) {
  const [template, setTemplate] = useState<InvoiceTemplateView | null>(null);
  const [draftId, setDraftId] = useState('');
  const [title, setTitle] = useState('Tax Invoice');
  const [footer, setFooter] = useState('Thank you for your business. Terms: Net 30 days.');
  const [locale, setLocale] = useState<'en-IN' | 'en-US'>('en-IN');
  const [accentColor, setAccentColor] = useState('#5E46C1');
  const [fields, setFields] = useState<InvoiceField[]>([
    'invoiceNumber',
    'issueDate',
    'dueDate',
    'customerName',
    'subtotal',
    'tax',
    'total',
    'amountPaid',
    'balance'
  ]);
  const [preview, setPreview] = useState<InvoiceTemplatePreview | null>(null);
  const [working, setWorking] = useState(false);

  const canManage = ['OWNER', 'ADMIN'].includes(role ?? '');
  const base = `${API}/document-templates/invoices`;

  const load = async (): Promise<void> => {
    const response = await apiFetch(base);
    if (!response.ok) throw new Error('Could not load invoice templates');
    const data: unknown = await response.json();
    if (!isView(data)) throw new Error('Invalid invoice template response');
    setTemplate(data);
    const version = data.draft || data.published;
    setDraftId(data.draft?.id || '');
    if (version) {
      setTitle(version.configuration.title);
      setFooter(version.configuration.footer);
      setLocale(version.configuration.locale);
      setAccentColor(version.configuration.accentColor);
      setFields(version.configuration.fields);
    } else {
      setDraftId('');
    }
  };

  useEffect(() => {
    if (canManage) {
      void load().catch((error: unknown) => notify(errorMessage(error)));
    }
  }, [canManage]);

  const request = async (path: string, method = 'POST', body?: unknown): Promise<unknown> => {
    const response = await apiFetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        isRecord(result) && typeof result.detail === 'string'
          ? result.detail
          : isRecord(result) && typeof result.message === 'string'
          ? result.message
          : 'Template update failed';
      throw new Error(detail);
    }
    return result;
  };

  const config = (): InvoiceTemplateConfig => ({
    documentType: 'INVOICE',
    title,
    footer,
    locale,
    accentColor,
    fields
  });

  const saveDraft = async (): Promise<string> => {
    let id = draftId;
    if (id) {
      await request(`/drafts/${id}`, 'PUT', config());
    } else {
      const created: unknown = await request('/drafts', 'POST', config());
      if (!isRecord(created) || typeof created.id !== 'string') {
        throw new Error('Invalid invoice template response');
      }
      id = created.id;
      setDraftId(id);
    }
    await load();
    return id;
  };

  const save = async (): Promise<void> => {
    setWorking(true);
    try {
      await saveDraft();
      notify('Invoice template draft saved');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const validate = async (): Promise<void> => {
    setWorking(true);
    try {
      const id = await saveDraft();
      const result = await request(`/${id}/validate`);
      if (!isValidation(result)) throw new Error('Invalid invoice template validation response');
      setPreview(result.preview);
      notify('Invoice template checks passed');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const publish = async (): Promise<void> => {
    setWorking(true);
    try {
      const id = await saveDraft();
      await request(`/${id}/validate`);
      await request(`/${id}/publish`);
      await load();
      notify('Invoice template published successfully');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const rollback = async (): Promise<void> => {
    setWorking(true);
    try {
      await request('/rollback');
      setPreview(null);
      await load();
      notify('Invoice template rolled back');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const toggle = (key: InvoiceField): void => {
    setFields((current) =>
      current.includes(key)
        ? current.filter((field) => field !== key)
        : current.length < 10
        ? [...current, key]
        : current
    );
  };

  if (!canManage) {
    return (
      <div className="reports-workbench-card" style={{ textAlign: 'center', padding: '36px' }}>
        <p style={{ color: 'var(--sp-text-muted)', fontSize: '13px' }}>
          Only workspace managers and administrators can access the Invoice Template Designer.
        </p>
      </div>
    );
  }

  // Active fields for preview
  const displayPreviewFields: InvoicePreviewField[] = preview
    ? preview.fields
    : fields.map((key) => ({
        key,
        label: fieldLabels[key],
        sampleValue: sampleFieldValues[key]
      }));

  return (
    <div className="reports-grid-2col">
      {/* Column 1: Configuration Studio */}
      <div className="reports-workbench-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
              Invoice Layout Studio
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '4px 0 0 0' }}>
              Design authorized customer billing templates with approved field schemas and custom branding.
            </p>
          </div>
          <span className="sales-status-pill blue" style={{ whiteSpace: 'nowrap' }}>
            {template?.published ? `Published v${template.published.version}` : 'No template published'}
          </span>
        </div>

        {/* Identity & Locale */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px' }}>
          <div>
            <label className="sales-input-label">DOCUMENT TITLE</label>
            <input
              className="sales-text-input"
              maxLength={100}
              value={title}
              placeholder="Tax Invoice"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="sales-input-label">LOCALE & FORMAT</label>
            <select
              className="sales-select-input"
              value={locale}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'en-IN' || val === 'en-US') setLocale(val);
              }}
            >
              <option value="en-IN">English (India) · ₹</option>
              <option value="en-US">English (US) · $</option>
            </select>
          </div>
        </div>

        {/* Branding & Accent */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label className="sales-input-label">ACCENT COLOR</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                style={{
                  width: '36px',
                  height: '32px',
                  padding: '1px 2px',
                  border: '1px solid var(--sp-border)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  background: 'var(--sp-surface)'
                }}
                title="Choose brand accent color"
              />
              <span style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text-secondary)' }}>
                {accentColor.toUpperCase()}
              </span>
            </div>
          </div>

          <div>
            <label className="sales-input-label">FOOTER DISCLAIMER & TERMS</label>
            <input
              className="sales-text-input"
              maxLength={240}
              value={footer}
              placeholder="e.g. Thank you for your business. Terms: Net 30 days."
              onChange={(e) => setFooter(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Fields Selection */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="sales-input-label" style={{ margin: 0 }}>
              INVOICE DATA FIELDS ({fields.length}/10 SELECTED)
            </label>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Number & Total are required
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {invoiceFields.map((key) => {
              const active = fields.includes(key);
              const isLocked = key === 'invoiceNumber' || key === 'total';
              return (
                <button
                  type="button"
                  key={key}
                  disabled={isLocked}
                  className={`reports-field-chip ${active ? 'active' : ''}`}
                  onClick={() => toggle(key)}
                  style={{
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.85 : 1
                  }}
                >
                  {active && <Check size={11} />}
                  <span>{fieldLabels[key]}</span>
                  {isLocked && (
                    <span style={{ fontSize: '10px', opacity: 0.65 }}>· req</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--sp-border)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="sales-action-btn primary"
              disabled={working}
              onClick={() => void publish()}
            >
              <Send size={12} />
              <span>Publish Template</span>
            </button>

            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={working}
              onClick={() => void validate()}
            >
              <Sparkles size={12} />
              <span>Preview & Validate</span>
            </button>

            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={working}
              onClick={() => void save()}
            >
              <Save size={12} />
              <span>Save Draft</span>
            </button>
          </div>

          {template?.history.some((v) => v.status === 'ROLLED_BACK') && (
            <button
              type="button"
              className="sales-action-btn secondary danger"
              disabled={working}
              onClick={() => void rollback()}
              title="Rollback to previous active revision"
            >
              <RotateCcw size={12} />
              <span>Rollback</span>
            </button>
          )}
        </div>
      </div>

      {/* Column 2: Live Document Preview & Version History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Live Preview Card */}
        <div className="reports-workbench-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sp-surface-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={13} style={{ color: 'var(--sp-brand)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                DOCUMENT LAYOUT PREVIEW
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              {locale === 'en-IN' ? 'INR (₹)' : 'USD ($)'}
            </span>
          </div>

          {/* Rendered Invoice Sheet */}
          <div className="invoice-preview-sheet" style={{ margin: '16px', borderTop: `3px solid ${accentColor}` }}>
            <div className="invoice-preview-header">
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--sp-text)' }}>
                  {title || 'Tax Invoice'}
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                  Spindl Enterprise Solutions · GSTIN 29AAAAA0000A1Z5
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="sales-status-pill green" style={{ fontSize: '10px' }}>
                  VALID LAYOUT
                </span>
              </div>
            </div>

            <div className="invoice-preview-body">
              {displayPreviewFields.map((field) => (
                <div key={field.key} className="invoice-preview-row">
                  <span style={{ color: 'var(--sp-text-secondary)', fontWeight: 500 }}>
                    {field.label}
                  </span>
                  <span style={{ color: 'var(--sp-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {field.sampleValue}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid var(--sp-border)', fontSize: '11px', color: 'var(--sp-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                {footer || 'Thank you for your business.'}
              </div>
            </div>
          </div>
        </div>

        {/* Template Versions Directory */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={13} style={{ color: 'var(--sp-text-muted)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                REVISION HISTORY
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              {template?.history.length || 0} versions
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {template?.history.length ? (
              template.history.map((version) => (
                <div key={version.id} className="reports-saved-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                        Version {version.version}
                      </span>
                      <span className={`sales-status-pill ${version.status === 'PUBLISHED' ? 'green' : version.status === 'ROLLED_BACK' ? 'red' : 'gray'}`}>
                        {formatAuditLabel(version.status)}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      {version.configuration.title} · {version.configuration.locale} · {version.configuration.fields.length} fields
                    </span>
                  </div>

                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: version.configuration.accentColor,
                      border: '1px solid var(--sp-border)'
                    }}
                    title={`Accent: ${version.configuration.accentColor}`}
                  />
                </div>
              ))
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '10px 0', textAlign: 'center' }}>
                No template revisions recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
