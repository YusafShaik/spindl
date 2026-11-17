import { useEffect, useState } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

type InvoiceField = 'invoiceNumber' | 'issueDate' | 'dueDate' | 'customerName' | 'customerEmail' | 'subtotal' | 'tax' | 'total' | 'amountPaid' | 'balance';
interface InvoiceTemplateConfig { documentType: 'INVOICE'; title: string; footer: string; locale: 'en-IN' | 'en-US'; accentColor: string; fields: InvoiceField[]; }
interface InvoiceTemplateVersion { id: string; version: number; status: string; configuration: InvoiceTemplateConfig; }
interface InvoiceTemplateView { key: string; published: InvoiceTemplateVersion | null; draft: InvoiceTemplateVersion | null; history: InvoiceTemplateVersion[]; }
interface InvoicePreviewField { key: InvoiceField; label: string; sampleValue: string; }
interface InvoiceTemplatePreview { version: InvoiceTemplateVersion; fields: InvoicePreviewField[]; }
interface InvoiceTemplateValidation { valid: boolean; checks: string[]; preview: InvoiceTemplatePreview; }

const fieldLabels: Record<InvoiceField, string> = { invoiceNumber: 'Invoice number', issueDate: 'Issue date', dueDate: 'Due date', customerName: 'Customer name', customerEmail: 'Customer email', subtotal: 'Subtotal', tax: 'Tax', total: 'Total', amountPaid: 'Amount paid', balance: 'Balance' };
const invoiceFields: InvoiceField[] = ['invoiceNumber', 'issueDate', 'dueDate', 'customerName', 'customerEmail', 'subtotal', 'tax', 'total', 'amountPaid', 'balance'];
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isInvoiceField(value: unknown): value is InvoiceField { return typeof value === 'string' && Object.hasOwn(fieldLabels, value); }
function isConfig(value: unknown): value is InvoiceTemplateConfig { return isRecord(value) && value.documentType === 'INVOICE' && typeof value.title === 'string' && typeof value.footer === 'string' && (value.locale === 'en-IN' || value.locale === 'en-US') && typeof value.accentColor === 'string' && Array.isArray(value.fields) && value.fields.every(isInvoiceField); }
function isVersion(value: unknown): value is InvoiceTemplateVersion { return isRecord(value) && typeof value.id === 'string' && typeof value.version === 'number' && typeof value.status === 'string' && isConfig(value.configuration); }
function isView(value: unknown): value is InvoiceTemplateView { return isRecord(value) && typeof value.key === 'string' && (value.published === null || isVersion(value.published)) && (value.draft === null || isVersion(value.draft)) && Array.isArray(value.history) && value.history.every(isVersion); }
function isPreviewField(value: unknown): value is InvoicePreviewField { return isRecord(value) && isInvoiceField(value.key) && typeof value.label === 'string' && typeof value.sampleValue === 'string'; }
function isPreview(value: unknown): value is InvoiceTemplatePreview { return isRecord(value) && isVersion(value.version) && Array.isArray(value.fields) && value.fields.every(isPreviewField); }
function isValidation(value: unknown): value is InvoiceTemplateValidation { return isRecord(value) && typeof value.valid === 'boolean' && Array.isArray(value.checks) && value.checks.every((check) => typeof check === 'string') && isPreview(value.preview); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function InvoiceTemplateDesigner({ notify, role }: { notify: (message: string) => void; role?: string }) {
  const [template, setTemplate] = useState<InvoiceTemplateView | null>(null);
  const [draftId, setDraftId] = useState('');
  const [title, setTitle] = useState('Tax invoice');
  const [footer, setFooter] = useState('Thank you for your business.');
  const [locale, setLocale] = useState<'en-IN' | 'en-US'>('en-IN');
  const [accentColor, setAccentColor] = useState('#5E46C1');
  const [fields, setFields] = useState<InvoiceField[]>(['invoiceNumber', 'issueDate', 'dueDate', 'customerName', 'subtotal', 'tax', 'total', 'amountPaid', 'balance']);
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
    } else setDraftId('');
  };
  useEffect(() => { if (canManage) void load().catch((error: unknown) => notify(errorMessage(error))); }, [canManage]);

  const request = async (path: string, method = 'POST', body?: unknown): Promise<unknown> => {
    const response = await apiFetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = isRecord(result) && typeof result.detail === 'string' ? result.detail : isRecord(result) && typeof result.message === 'string' ? result.message : 'Template update failed';
      throw new Error(detail);
    }
    return result;
  };
  const config = (): InvoiceTemplateConfig => ({ documentType: 'INVOICE', title, footer, locale, accentColor, fields });
  const saveDraft = async (): Promise<string> => {
    let id = draftId;
    if (id) await request(`/drafts/${id}`, 'PUT', config());
    else {
      const created: unknown = await request('/drafts', 'POST', config());
      if (!isRecord(created) || typeof created.id !== 'string') throw new Error('Invalid invoice template response');
      id = created.id;
      setDraftId(id);
    }
    await load();
    return id;
  };
  const save = async (): Promise<void> => { setWorking(true); try { await saveDraft(); notify('Invoice template draft saved'); } catch (error) { notify(errorMessage(error)); } finally { setWorking(false); } };
  const validate = async (): Promise<void> => { setWorking(true); try { const id = await saveDraft(); const result = await request(`/${id}/validate`); if (!isValidation(result)) throw new Error('Invalid invoice template validation response'); setPreview(result.preview); notify('Invoice template checks passed'); } catch (error) { notify(errorMessage(error)); } finally { setWorking(false); } };
  const publish = async (): Promise<void> => { setWorking(true); try { const id = await saveDraft(); await request(`/${id}/validate`); await request(`/${id}/publish`); await load(); notify('Invoice template published'); } catch (error) { notify(errorMessage(error)); } finally { setWorking(false); } };
  const rollback = async (): Promise<void> => { setWorking(true); try { await request('/rollback'); setPreview(null); await load(); notify('Invoice template rolled back'); } catch (error) { notify(errorMessage(error)); } finally { setWorking(false); } };
  const toggle = (key: InvoiceField): void => setFields((current) => current.includes(key) ? current.filter((field) => field !== key) : current.length < 10 ? [...current, key] : current);
  if (!canManage) return null;

  return <section className="panel directory-panel saved-report-builder"><div className="panel-header directory-top"><div><h2>Invoice document template</h2><p>Design a safe invoice layout with approved fields, locale, and branding. Template text is never interpreted as markup.</p></div><span className="record-count">{template?.published ? `Published v${template.published.version}` : 'No template published'}</span></div><div className="transaction-filters"><label>Document title<input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Locale<select value={locale} onChange={(event) => { const value = event.target.value; if (value === 'en-IN' || value === 'en-US') setLocale(value); }}><option value="en-IN">English (India)</option><option value="en-US">English (United States)</option></select></label><label>Accent color<input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)}/></label><label>Footer text<input maxLength={240} value={footer} onChange={(event) => setFooter(event.target.value)}/></label><div className="report-builder-columns">{invoiceFields.map((key) => <label key={key}><input type="checkbox" checked={fields.includes(key)} disabled={key === 'invoiceNumber' || key === 'total'} onChange={() => toggle(key)}/>{fieldLabels[key]}{key === 'invoiceNumber' || key === 'total' ? ' (required)' : ''}</label>)}</div><div className="report-builder-filter-row"><button className="filter-button" disabled={working} onClick={() => void save()}>Save draft</button><button className="filter-button" disabled={working} onClick={() => void validate()}>Preview and validate</button><button className="button button-primary" disabled={working} onClick={() => void publish()}>Publish template</button>{template?.history.some((version) => version.status === 'ROLLED_BACK') && <button className="filter-button" disabled={working} onClick={() => void rollback()}>Rollback</button>}</div></div>
    {preview && <div className="report-builder-saved"><b>Invoice preview</b><article style={{ display: 'block', borderTop: `4px solid ${preview.version.configuration.accentColor}` }}><h3>{preview.version.configuration.title}</h3>{preview.fields.map((field) => <p key={field.key}><b>{field.label}</b><span style={{ float: 'right' }}>{field.sampleValue}</span></p>)}<small>{preview.version.configuration.footer}</small></article></div>}
    <div className="report-builder-saved"><b>Template versions</b>{template?.history.length ? template.history.map((version) => <article key={version.id}><span><strong>Version {version.version} · {formatAuditLabel(version.status)}</strong><small>{version.configuration.title} · {version.configuration.locale} · {version.configuration.fields.length} fields</small></span></article>) : <p className="empty-cell">No invoice templates saved.</p>}</div>
  </section>;
}
