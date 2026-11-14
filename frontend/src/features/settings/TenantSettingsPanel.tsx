import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { Status } from '../../components/ui/Status';
import { AttachmentsPanel } from '../attachments/AttachmentsPanel';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import { TenantApiTokensPanel, TenantWebhooksPanel } from './IntegrationSettings';
import { PlanUsagePanel, PlatformPlanReviewPanel } from './PlanSettingsPanels';
import { PlatformSupportPanel } from './PlatformSupportPanel';
import { TenantBranchesPanel } from './TenantBranchesPanel';
import { TenantRolesPanel } from './TenantRolesPanel';
import { TenantSupportConsentPanel } from './TenantSupportConsentPanel';

interface TenantSettings {
  id: string; slug: string; displayName: string; legalName: string | null; timezone: string;
  countryCode: string; currencyCode: string; fiscalYearStartMonth: number; status: string;
  gracePeriodEndsAt: string | null;
}
interface TenantModule { code: string; name: string; enabled: boolean; entitled: boolean; required: boolean; dependencies: string[]; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isSettings(value: unknown): value is TenantSettings { return isRecord(value) && typeof value.id === 'string' && typeof value.slug === 'string' && typeof value.displayName === 'string' && (typeof value.legalName === 'string' || value.legalName === null) && typeof value.timezone === 'string' && typeof value.countryCode === 'string' && typeof value.currencyCode === 'string' && typeof value.fiscalYearStartMonth === 'number' && typeof value.status === 'string' && (typeof value.gracePeriodEndsAt === 'string' || value.gracePeriodEndsAt === null); }
function isModule(value: unknown): value is TenantModule { return isRecord(value) && typeof value.code === 'string' && typeof value.name === 'string' && typeof value.enabled === 'boolean' && typeof value.entitled === 'boolean' && typeof value.required === 'boolean' && Array.isArray(value.dependencies) && value.dependencies.every((dependency) => typeof dependency === 'string'); }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

interface TenantSettingsPanelProps { role?: string; notify: (message: string) => void; onSaved: (name: string) => void; onModulesChange: (modules: string[]) => void; }
export function TenantSettingsPanel({ role, notify, onSaved, onModulesChange }: TenantSettingsPanelProps) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [saving, setSaving] = useState(false);
  const canEdit = ['OWNER', 'ADMIN'].includes(role ?? '');
  useEffect(() => {
    let current = true;
    void apiFetch(`${API}/tenant/settings`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load workspace settings');
      const value: unknown = await response.json();
      if (!isSettings(value)) throw new Error('Invalid workspace settings response');
      if (current) setSettings(value);
    }).catch((error: unknown) => notify(messageFrom(error)));
    return () => { current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    void apiFetch(`${API}/tenant/modules`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load module access');
      const value: unknown = await response.json();
      if (!Array.isArray(value) || !value.every(isModule)) throw new Error('Invalid module access response');
      if (current) setModules(value);
    }).catch((error: unknown) => notify(messageFrom(error)));
    return () => { current = false; };
  }, []);
  const update = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]): void => setSettings((current) => current ? { ...current, [key]: value } : current);
  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const payload = { displayName: settings.displayName, legalName: settings.legalName || null, timezone: settings.timezone, countryCode: settings.countryCode, currencyCode: settings.currencyCode, fiscalYearStartMonth: Number(settings.fiscalYearStartMonth) };
      const response = await apiFetch(`${API}/tenant/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(isRecord(body) && (typeof body.detail === 'string' || typeof body.message === 'string') ? String(body.detail || body.message) : 'Could not save workspace settings');
      if (!isSettings(body)) throw new Error('Invalid workspace settings response');
      setSettings(body); onSaved(body.displayName); notify('Workspace settings saved');
    } catch (error) { notify(messageFrom(error)); } finally { setSaving(false); }
  };
  const toggleModule = async (module: TenantModule): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/modules/${module.code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !module.enabled }) });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(isRecord(body) && (typeof body.detail === 'string' || typeof body.message === 'string') ? String(body.detail || body.message) : 'Could not update module access');
      if (!Array.isArray(body) || !body.every(isModule)) throw new Error('Invalid module access response');
      setModules(body); onModulesChange(body.filter((item) => item.enabled && item.entitled).map((item) => item.code)); notify(`${module.name} ${module.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) { notify(messageFrom(error)); } finally { setSaving(false); }
  };
  if (!settings) return <section className="panel tenant-settings-panel"><p className="empty-cell">Loading workspace settings…</p></section>;
  return <div className="tenant-settings-layout"><section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Workspace profile</h2><p>Set your business identity, local timezone, currency, and fiscal year.</p></div><Status label={formatAuditLabel(settings.status)}/></div><form className="tenant-settings-form" onSubmit={(event) => void save(event)}><label>Workspace name<input value={settings.displayName} maxLength={180} required disabled={!canEdit} onChange={(event) => update('displayName', event.target.value)}/></label><label>Legal business name<input value={settings.legalName || ''} maxLength={180} disabled={!canEdit} onChange={(event) => update('legalName', event.target.value)}/></label><label>Timezone<input value={settings.timezone} maxLength={64} placeholder="UTC" required disabled={!canEdit} onChange={(event) => update('timezone', event.target.value)}/></label><label>Country code<input value={settings.countryCode} maxLength={2} pattern="[A-Za-z]{2}" required disabled={!canEdit} onChange={(event) => update('countryCode', event.target.value.toUpperCase())}/></label><label>Currency<input value={settings.currencyCode} maxLength={3} pattern="[A-Za-z]{3}" required disabled={!canEdit} onChange={(event) => update('currencyCode', event.target.value.toUpperCase())}/></label><label>Fiscal year starts<select value={settings.fiscalYearStartMonth} disabled={!canEdit} onChange={(event) => update('fiscalYearStartMonth', Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Date(2026, month - 1, 1).toLocaleString(undefined, { month: 'long' })}</option>)}</select></label>{canEdit && <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save workspace settings'}</button>}</form><div className="tenant-settings-meta"><div><small>WORKSPACE ID</small><code>{settings.id}</code></div><div><small>WORKSPACE SLUG</small><code>{settings.slug}</code></div><div><small>ACCOUNT STATUS</small><b>{formatAuditLabel(settings.status)}{settings.gracePeriodEndsAt ? ` · through ${new Date(settings.gracePeriodEndsAt).toLocaleDateString()}` : ''}</b></div></div>{!canEdit && <p className="form-note">Only workspace owners and admins can update these settings.</p>}</section><PlanUsagePanel role={role} notify={notify}/><PlatformPlanReviewPanel notify={notify}/><TenantSupportConsentPanel role={role} notify={notify}/><PlatformSupportPanel notify={notify}/><TenantBranchesPanel role={role} notify={notify}/><AttachmentsPanel notify={notify}/><CustomFieldsPanel role={role} notify={notify}/><TenantRolesPanel role={role} notify={notify}/><TenantApiTokensPanel role={role} notify={notify}/><TenantWebhooksPanel role={role} notify={notify}/><section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Modules</h2><p>Turn workspace modules on or off. Disabling a module hides it and blocks its APIs while preserving its records.</p></div></div><div className="tenant-modules-grid">{modules.map((module) => <article className="tenant-module-card" key={module.code}><div><b>{module.name}</b><small>{module.dependencies.length ? `Requires ${module.dependencies.map((code) => modules.find((candidate) => candidate.code === code)?.name || code).join(', ')}` : module.required ? 'Workspace foundation' : 'Optional module'}</small></div><span className={`module-state ${module.enabled ? 'enabled' : ''}`}>{module.enabled ? 'Enabled' : module.entitled ? 'Disabled' : 'Not in plan'}</span>{!module.required && <button className="mini-action" disabled={saving || !canEdit || !module.entitled} onClick={() => void toggleModule(module)}>{module.enabled ? 'Disable' : 'Enable'}</button>}{module.required && <small className="module-required">Required</small>}</article>)}{!modules.length && <p className="empty-cell">Loading module access…</p>}</div>{!canEdit && <p className="form-note">Only workspace owners and admins can change enabled modules.</p>}</section><section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Access and lifecycle</h2><p>Workspace access follows the account status and billing grace period.</p></div></div><ul className="tenant-lifecycle-list"><li><b>Active or trial</b><span>Workspace members can use permitted features.</span></li><li><b>Past due</b><span>Write access remains available during the grace period.</span></li><li><b>Suspended</b><span>Workspace data is read-only until access is restored.</span></li><li><b>Closed</b><span>Workspace access is blocked; data is retained for platform policy.</span></li></ul></section></div>;
}
