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
      notify('Workspace profile and settings saved');
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

  if (!settings) {
    return (
      <section className="panel tenant-settings-panel" style={{ padding: '48px', textAlign: 'center' }}>
        <p className="empty-cell">Loading workspace settings…</p>
      </section>
    );
  }

  return (
    <div className="tenant-settings-layout">
      {/* 1. Executive Workspace Header Card */}
      <div className="settings-header-card">
        <div className="settings-header-left">
          <div className="settings-avatar-monogram" title={settings.displayName}>
            {monogram}
          </div>
          <div className="settings-header-info">
            <h2 className="settings-workspace-name">
              {settings.displayName}
              {settings.legalName && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sp-text-muted)' }}>
                  ({settings.legalName})
                </span>
              )}
            </h2>
            <div className="settings-workspace-slug-row">
              <span>Slug:</span>
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

              <span>ID:</span>
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
          <div className="settings-status-pill">
            <span className="settings-status-dot" />
            {formatAuditLabel(settings.status)}
            {settings.gracePeriodEndsAt
              ? ` · Thru ${new Date(settings.gracePeriodEndsAt).toLocaleDateString()}`
              : ''}
          </div>
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
              {tab.label}
              {tab.badge && <span className="settings-nav-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* 3. Sub-Tab Content Views */}
      {activeTab === 'profile' && (
        <>
          <section className="panel tenant-settings-panel">
            <div className="panel-header">
              <div>
                <h2>Workspace profile & localisation</h2>
                <p>Define your enterprise business identity, time zone, primary currency, and accounting fiscal year.</p>
              </div>
              <Status label={formatAuditLabel(settings.status)} />
            </div>

            <form className="tenant-settings-form" onSubmit={(event) => void save(event)}>
              <label>
                Workspace display name *
                <input
                  value={settings.displayName}
                  maxLength={180}
                  required
                  disabled={!canEdit}
                  onChange={(event) => update('displayName', event.target.value)}
                />
              </label>

              <label>
                Legal enterprise business name
                <input
                  value={settings.legalName || ''}
                  maxLength={180}
                  placeholder="Official incorporated entity name"
                  disabled={!canEdit}
                  onChange={(event) => update('legalName', event.target.value)}
                />
              </label>

              <label>
                Operating timezone *
                <input
                  value={settings.timezone}
                  maxLength={64}
                  placeholder="Asia/Kolkata or UTC"
                  required
                  disabled={!canEdit}
                  onChange={(event) => update('timezone', event.target.value)}
                />
              </label>

              <label>
                Country ISO code (2 letters) *
                <input
                  value={settings.countryCode}
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  required
                  disabled={!canEdit}
                  onChange={(event) => update('countryCode', event.target.value.toUpperCase())}
                />
              </label>

              <label>
                Primary operating currency (3 letters) *
                <input
                  value={settings.currencyCode}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  required
                  disabled={!canEdit}
                  onChange={(event) => update('currencyCode', event.target.value.toUpperCase())}
                />
              </label>

              <label>
                Fiscal year starts in *
                <select
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
              </label>

              {canEdit && (
                <button className="button button-primary" disabled={saving}>
                  {saving ? 'Saving changes…' : 'Save workspace profile'}
                </button>
              )}
            </form>

            <div className="tenant-settings-meta">
              <div>
                <small>WORKSPACE ID</small>
                <code>{settings.id}</code>
              </div>
              <div>
                <small>WORKSPACE SLUG</small>
                <code>{settings.slug}</code>
              </div>
              <div>
                <small>ACCOUNT STATUS</small>
                <b>
                  {formatAuditLabel(settings.status)}
                  {settings.gracePeriodEndsAt
                    ? ` · through ${new Date(settings.gracePeriodEndsAt).toLocaleDateString()}`
                    : ''}
                </b>
              </div>
            </div>

            {!canEdit && (
              <p className="form-note">Only workspace owners and admins can update profile settings.</p>
            )}
          </section>

          {/* Access & Lifecycle Summary */}
          <section className="panel tenant-settings-panel">
            <div className="panel-header">
              <div>
                <h2>Workspace access & account lifecycle</h2>
                <p>Spindl access privileges conform to account billing status and workspace policy.</p>
              </div>
            </div>

            <ul className="tenant-lifecycle-list">
              <li className={['ACTIVE', 'TRIAL'].includes(settings.status) ? 'current-status' : ''}>
                <b>Active or trial</b>
                <span>Workspace members have full read/write operational access across enabled modules.</span>
              </li>
              <li className={settings.status === 'PAST_DUE' ? 'current-status' : ''}>
                <b>Past due</b>
                <span>Full write access remains active through the defined billing grace period.</span>
              </li>
              <li className={settings.status === 'SUSPENDED' ? 'current-status' : ''}>
                <b>Suspended</b>
                <span>Workspace records are preserved in read-only mode until subscription is restored.</span>
              </li>
              <li className={settings.status === 'CLOSED' ? 'current-status' : ''}>
                <b>Closed</b>
                <span>Access is locked; workspace data is retained in accordance with retention policy.</span>
              </li>
            </ul>
          </section>
        </>
      )}

      {activeTab === 'modules' && (
        <section className="panel tenant-settings-panel">
          <div className="panel-header">
            <div>
              <h2>Workspace modules & features</h2>
              <p>
                Configure which operational modules are active in this workspace. Disabling a module hides its
                navigation and locks its APIs without deleting records.
              </p>
            </div>
          </div>

          <div className="tenant-modules-grid">
            {modules.map((module) => (
              <article className="tenant-module-card" key={module.code}>
                <div className="tenant-module-card-top">
                  <b>{module.name}</b>
                  <span className={`module-state ${module.enabled ? 'enabled' : ''}`}>
                    {module.enabled ? 'Enabled' : module.entitled ? 'Disabled' : 'Not in plan'}
                  </span>
                </div>

                <small>
                  {module.dependencies.length
                    ? `Requires ${module.dependencies
                        .map((code) => modules.find((c) => c.code === code)?.name || code)
                        .join(', ')}`
                    : module.required
                    ? 'Workspace foundation module'
                    : 'Optional module'}
                </small>

                <div className="tenant-module-card-actions">
                  {!module.required ? (
                    <button
                      type="button"
                      className="mini-action"
                      disabled={saving || !canEdit || !module.entitled}
                      onClick={() => void toggleModule(module)}
                    >
                      {module.enabled ? 'Disable module' : 'Enable module'}
                    </button>
                  ) : (
                    <span className="module-required">Required core</span>
                  )}
                </div>
              </article>
            ))}
            {!modules.length && <p className="empty-cell">Loading module entitlements…</p>}
          </div>

          {!canEdit && (
            <p className="form-note">Only workspace owners and admins can configure operational modules.</p>
          )}
        </section>
      )}

      {activeTab === 'branches' && (
        <TenantBranchesPanel role={role} notify={notify} />
      )}

      {activeTab === 'roles' && (
        <TenantRolesPanel role={role} notify={notify} />
      )}

      {activeTab === 'integrations' && (
        <>
          <TenantApiTokensPanel role={role} notify={notify} />
          <TenantWebhooksPanel role={role} notify={notify} />
        </>
      )}

      {activeTab === 'custom-fields' && (
        <CustomFieldsPanel role={role} notify={notify} />
      )}

      {activeTab === 'billing' && (
        <>
          <PlanUsagePanel role={role} notify={notify} />
          <PlatformPlanReviewPanel notify={notify} />
        </>
      )}

      {activeTab === 'security' && (
        <>
          <TenantSupportConsentPanel role={role} notify={notify} />
          <PlatformSupportPanel notify={notify} />
          <AttachmentsPanel notify={notify} />
        </>
      )}
    </div>
  );
}
