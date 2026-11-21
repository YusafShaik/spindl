import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  Boxes,
  Building2,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Layers,
  Lock,
  MapPin,
  Shield,
  Sliders,
  Sparkles,
  Webhook
} from 'lucide-react';
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
  id: string;
  slug: string;
  displayName: string;
  legalName: string | null;
  timezone: string;
  countryCode: string;
  currencyCode: string;
  fiscalYearStartMonth: number;
  status: string;
  gracePeriodEndsAt: string | null;
}

interface TenantModule {
  code: string;
  name: string;
  enabled: boolean;
  entitled: boolean;
  required: boolean;
  dependencies: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSettings(value: unknown): value is TenantSettings {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.displayName === 'string' &&
    (typeof value.legalName === 'string' || value.legalName === null) &&
    typeof value.timezone === 'string' &&
    typeof value.countryCode === 'string' &&
    typeof value.currencyCode === 'string' &&
    typeof value.fiscalYearStartMonth === 'number' &&
    typeof value.status === 'string' &&
    (typeof value.gracePeriodEndsAt === 'string' || value.gracePeriodEndsAt === null)
  );
}

function isModule(value: unknown): value is TenantModule {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.entitled === 'boolean' &&
    typeof value.required === 'boolean' &&
    Array.isArray(value.dependencies) &&
    value.dependencies.every((d) => typeof d === 'string')
  );
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SettingsTab =
  | 'profile'
  | 'modules'
  | 'branches'
  | 'roles'
  | 'integrations'
  | 'custom-fields'
  | 'billing'
  | 'security';

interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: typeof Building2;
  badge?: string | number;
}

interface TenantSettingsPanelProps {
  role?: string;
  notify: (message: string) => void;
  onSaved: (name: string) => void;
  onModulesChange: (modules: string[]) => void;
}

export function TenantSettingsPanel({
  role,
  notify,
  onSaved,
  onModulesChange
}: TenantSettingsPanelProps) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [moduleFilter, setModuleFilter] = useState<'ALL' | 'ENABLED' | 'REQUIRED'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canEdit = ['OWNER', 'ADMIN'].includes(role ?? '');

  useEffect(() => {
    let current = true;
    void apiFetch(`${API}/tenant/settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load workspace settings');
        const value: unknown = await response.json();
        if (!isSettings(value)) throw new Error('Invalid workspace settings response');
        if (current) setSettings(value);
      })
      .catch((error: unknown) => notify(messageFrom(error)));
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    void apiFetch(`${API}/tenant/modules`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load module access');
        const value: unknown = await response.json();
        if (!Array.isArray(value) || !value.every(isModule))
          throw new Error('Invalid module access response');
        if (current) setModules(value);
      })
      .catch((error: unknown) => notify(messageFrom(error)));
    return () => {
      current = false;
    };
  }, []);

  const update = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]): void =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const payload = {
        displayName: settings.displayName,
        legalName: settings.legalName || null,
        timezone: settings.timezone,
        countryCode: settings.countryCode,
        currencyCode: settings.currencyCode,
        fiscalYearStartMonth: Number(settings.fiscalYearStartMonth)
      };
      const response = await apiFetch(`${API}/tenant/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          isRecord(body) &&
            (typeof body.detail === 'string' || typeof body.message === 'string')
            ? String(body.detail || body.message)
            : 'Could not save workspace settings'
        );
      if (!isSettings(body)) throw new Error('Invalid workspace settings response');
      setSettings(body);
      onSaved(body.displayName);
      notify('Workspace profile and settings saved successfully');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = async (module: TenantModule): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/modules/${module.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !module.enabled })
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          isRecord(body) &&
            (typeof body.detail === 'string' || typeof body.message === 'string')
            ? String(body.detail || body.message)
            : 'Could not update module access'
        );
      if (!Array.isArray(body) || !body.every(isModule))
        throw new Error('Invalid module access response');
      setModules(body);
      onModulesChange(
        body.filter((item) => item.enabled && item.entitled).map((item) => item.code)
      );
      notify(`${module.name} ${module.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      notify(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      notify('Could not copy to clipboard');
    }
  };

  // Monogram for workspace avatar
  const monogram = useMemo(() => {
    if (!settings?.displayName) return 'SP';
    const parts = settings.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return settings.displayName.slice(0, 2).toUpperCase();
  }, [settings?.displayName]);

  // Tab definitions
  const tabs: SettingsTabConfig[] = useMemo(() => {
    const enabledCount = modules.filter((m) => m.enabled).length;
    return [
      { id: 'profile', label: 'Profile', icon: Building2 },
      {
        id: 'modules',
        label: 'Modules',
        icon: Boxes,
        badge: modules.length ? `${enabledCount}/${modules.length}` : undefined
      },
      { id: 'branches', label: 'Branches', icon: MapPin },
      { id: 'roles', label: 'Roles & Access', icon: Shield },
      { id: 'integrations', label: 'Integrations & API', icon: Webhook },
      { id: 'custom-fields', label: 'Custom Fields', icon: Sliders },
      { id: 'billing', label: 'Plan & Usage', icon: CreditCard },
      { id: 'security', label: 'Security & Files', icon: Lock }
    ];
  }, [modules]);

  // Filtered Modules
  const filteredModules = useMemo(() => {
    if (moduleFilter === 'ENABLED') return modules.filter((m) => m.enabled);
    if (moduleFilter === 'REQUIRED') return modules.filter((m) => m.required);
    return modules;
  }, [modules, moduleFilter]);

  if (!settings) {
    return (
      <div className="reports-workbench-card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--sp-text-muted)', fontSize: '13px' }}>Loading workspace settings…</p>
      </div>
    );
  }

  return (
    <div className="sales-screen-layout tenant-settings-layout" style={{ gap: '14px' }}>
      {/* 1. Executive Workspace Identity Header */}
      <div className="sales-table-card settings-header-card" style={{ padding: '12px 18px' }}>
        <div className="settings-header-left">
          <div className="settings-avatar-monogram" title={settings.displayName}>
            {monogram}
          </div>
          <div className="settings-header-info">
            <h2 className="settings-workspace-name" style={{ fontSize: '15px' }}>
              {settings.displayName}
              {settings.legalName && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sp-text-muted)', marginLeft: '6px' }}>
                  ({settings.legalName})
                </span>
              )}
            </h2>
            <div className="settings-workspace-slug-row">
              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>Slug:</span>
              <button
                type="button"
                className="settings-code-chip"
                onClick={() => copyToClipboard(settings.slug, 'slug', 'Workspace slug')}
                title="Click to copy slug"
              >
                <code>{settings.slug}</code>
                {copiedKey === 'slug' ? <Check size={11} color="var(--sp-success)" /> : <Copy size={11} />}
              </button>

              <span style={{ margin: '0 4px', color: 'var(--sp-border-strong)' }}>·</span>

              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>ID:</span>
              <button
                type="button"
                className="settings-code-chip"
                onClick={() => copyToClipboard(settings.id, 'id', 'Workspace ID')}
                title="Click to copy full ID"
              >
                <code>{settings.id.slice(0, 8)}…</code>
                {copiedKey === 'id' ? <Check size={11} color="var(--sp-success)" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-header-right">
          <Status label={settings.status} />
          {role && <span className="settings-role-badge">{role}</span>}
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tab Bar */}
      <nav className="settings-nav-bar" aria-label="Settings sub-navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.badge && <span className="settings-nav-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* 3. Sub-Tab Content Views */}

      {/* TAB 1: WORKSPACE PROFILE */}
      {activeTab === 'profile' && (
        <div className="settings-grid-2col">
          {/* Column 1: Primary Profile Settings Workbench */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Workspace profile & localisation</h3>
                <p>Define your enterprise business identity, operational timezone, and fiscal calendar.</p>
              </div>
            </div>

            <form onSubmit={(event) => void save(event)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="settings-form-row">
                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Workspace display name <span className="required-dot">*</span>
                  </label>
                  <input
                    className="sales-text-input"
                    value={settings.displayName}
                    maxLength={180}
                    required
                    disabled={!canEdit}
                    onChange={(event) => update('displayName', event.target.value)}
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Legal enterprise business name</label>
                  <input
                    className="sales-text-input"
                    value={settings.legalName || ''}
                    maxLength={180}
                    placeholder="Official incorporated entity name"
                    disabled={!canEdit}
                    onChange={(event) => update('legalName', event.target.value)}
                  />
                </div>
              </div>

              <div className="settings-form-row">
                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Operating timezone <span className="required-dot">*</span>
                  </label>
                  <input
                    className="sales-text-input"
                    value={settings.timezone}
                    maxLength={64}
                    placeholder="Asia/Kolkata or UTC"
                    required
                    disabled={!canEdit}
                    onChange={(event) => update('timezone', event.target.value)}
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Country ISO code (2 letters) <span className="required-dot">*</span>
                  </label>
                  <input
                    className="sales-text-input"
                    value={settings.countryCode}
                    maxLength={2}
                    pattern="[A-Za-z]{2}"
                    required
                    disabled={!canEdit}
                    onChange={(event) => update('countryCode', event.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="settings-form-row">
                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Primary operating currency (3 letters) <span className="required-dot">*</span>
                  </label>
                  <input
                    className="sales-text-input"
                    value={settings.currencyCode}
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                    required
                    disabled={!canEdit}
                    onChange={(event) => update('currencyCode', event.target.value.toUpperCase())}
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Fiscal year starts in <span className="required-dot">*</span>
                  </label>
                  <select
                    className="sales-select-input"
                    value={settings.fiscalYearStartMonth}
                    disabled={!canEdit}
                    onChange={(event) => update('fiscalYearStartMonth', Number(event.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {new Date(2026, month - 1, 1).toLocaleString(undefined, { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {canEdit && (
                <div className="settings-form-footer">
                  <button type="submit" className="sales-action-btn primary" disabled={saving}>
                    {saving ? 'Saving changes…' : 'Save workspace profile'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Column 2: Workspace Details & Governance Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Identity Details Card */}
            <div className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h3 style={{ fontSize: '13px' }}>Workspace details</h3>
                  <p>Identifiers and tenant routing keys</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed var(--sp-border-subtle)' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Workspace slug</span>
                  <button
                    type="button"
                    className="settings-code-chip"
                    onClick={() => copyToClipboard(settings.slug, 'slug', 'Workspace slug')}
                    title="Click to copy slug"
                  >
                    <code>{settings.slug}</code>
                    {copiedKey === 'slug' ? <Check size={11} color="var(--sp-success)" /> : <Copy size={11} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed var(--sp-border-subtle)' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Workspace UUID</span>
                  <button
                    type="button"
                    className="settings-code-chip"
                    onClick={() => copyToClipboard(settings.id, 'id', 'Workspace ID')}
                    title="Click to copy full ID"
                  >
                    <code>{settings.id.slice(0, 14)}…</code>
                    {copiedKey === 'id' ? <Check size={11} color="var(--sp-success)" /> : <Copy size={11} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Your access privilege</span>
                  <span className="settings-role-badge">{role || 'MEMBER'}</span>
                </div>
              </div>
            </div>

            {/* Lifecycle & Policy Card */}
            <div className="settings-card">
              <div className="settings-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={14} style={{ color: 'var(--sp-brand)' }} />
                  <div>
                    <h3 style={{ fontSize: '13px' }}>Account access & lifecycle</h3>
                    <p>Status, privileges, and data retention</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-secondary)', lineHeight: '1.45' }}>
                <div style={{ padding: '8px 10px', borderRadius: '5px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: '#10b981' }}>
                    {formatAuditLabel(settings.status)} status active
                  </span>
                </div>
                <p style={{ margin: 0 }}>
                  Workspace members have full read/write operational access across all enabled ERP modules.
                </p>
                <p style={{ margin: 0, color: 'var(--sp-text-muted)' }}>
                  {settings.gracePeriodEndsAt
                    ? `Grace period extended through ${new Date(settings.gracePeriodEndsAt).toLocaleDateString()}.`
                    : 'Records and data retention conform to standard corporate governance.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKSPACE MODULES */}
      {activeTab === 'modules' && (
        <div className="settings-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--sp-border)', background: 'var(--sp-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Workspace modules & feature access
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                Configure active operational modules in this workspace. Disabling hides navigation without deleting records.
              </p>
            </div>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${moduleFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setModuleFilter('ALL')}
              >
                All <span className="sales-pill-count">{modules.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${moduleFilter === 'ENABLED' ? 'active' : ''}`}
                onClick={() => setModuleFilter('ENABLED')}
              >
                Enabled <span className="sales-pill-count">{modules.filter((m) => m.enabled).length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${moduleFilter === 'REQUIRED' ? 'active' : ''}`}
                onClick={() => setModuleFilter('REQUIRED')}
              >
                Core <span className="sales-pill-count">{modules.filter((m) => m.required).length}</span>
              </button>
            </div>
          </div>

          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredModules.map((module) => (
              <div
                key={module.code}
                style={{
                  background: 'var(--sp-surface)',
                  border: '1px solid var(--sp-border)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'border-color var(--sp-transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{module.name}</b>
                  <Status label={module.enabled ? 'Active' : 'Inactive'} />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', minHeight: '26px' }}>
                  {module.dependencies.length
                    ? `Requires ${module.dependencies
                        .map((code) => modules.find((c) => c.code === code)?.name || code)
                        .join(', ')}`
                    : module.required
                    ? 'Required platform foundation'
                    : 'Optional enterprise module'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    {module.required ? 'Core Platform' : module.entitled ? 'Entitled in plan' : 'Not in plan'}
                  </span>
                  {!module.required ? (
                    <button
                      type="button"
                      className={`sales-action-btn ${module.enabled ? 'secondary' : 'primary'}`}
                      disabled={saving || !canEdit || !module.entitled}
                      onClick={() => void toggleModule(module)}
                      style={{ height: '26px', fontSize: '11px', padding: '0 10px' }}
                    >
                      {module.enabled ? 'Disable' : 'Enable'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-brand)' }}>
                      Foundation
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BRANCHES */}
      {activeTab === 'branches' && (
        <TenantBranchesPanel role={role} notify={notify} />
      )}

      {/* TAB 4: ROLES & ACCESS */}
      {activeTab === 'roles' && (
        <TenantRolesPanel role={role} notify={notify} />
      )}

      {/* TAB 5: INTEGRATIONS & API */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TenantApiTokensPanel role={role} notify={notify} />
          <TenantWebhooksPanel role={role} notify={notify} />
        </div>
      )}

      {/* TAB 6: CUSTOM FIELDS */}
      {activeTab === 'custom-fields' && (
        <CustomFieldsPanel role={role} notify={notify} />
      )}

      {/* TAB 7: PLAN & USAGE */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PlanUsagePanel role={role} notify={notify} />
          <PlatformPlanReviewPanel notify={notify} />
        </div>
      )}

      {/* TAB 8: SECURITY & FILES */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TenantSupportConsentPanel role={role} notify={notify} />
          <PlatformSupportPanel notify={notify} />
          <AttachmentsPanel notify={notify} />
        </div>
      )}
    </div>
  );
}
