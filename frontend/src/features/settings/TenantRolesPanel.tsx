import { useEffect, useState, type FormEvent } from 'react';
import { Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';

interface RoleGrant {
  module: string;
  resource: string;
  action: string;
  scope: string;
}

interface TenantRole {
  id: string;
  roleCode: string;
  displayName: string;
  description: string;
  systemRole: boolean;
  permissions: RoleGrant[];
}

interface GrantDraft extends RoleGrant {}

const modules = [
  'dashboard',
  'crm',
  'catalog',
  'inventory',
  'sales',
  'purchasing',
  'manufacturing',
  'quality',
  'finance',
  'imports',
  'team',
  'operations',
  'tenant'
];

const actions = [
  'view',
  'create',
  'edit',
  'approve',
  'export',
  'import',
  'delete',
  'assign',
  'adjust',
  'pay',
  'credit',
  'receive',
  'return',
  'fulfill',
  'release',
  'issue',
  'start',
  'complete'
];

const scopeLabels: Record<string, string> = {
  OWN: 'Owned records',
  TEAM: 'My direct reports',
  BRANCH: 'Assigned branches',
  ALL: 'All records'
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

export function TenantRolesPanel({
  role,
  notify
}: {
  role?: string;
  notify: (message: string) => void;
}) {
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [draft, setDraft] = useState<RoleGrant[]>([]);
  const [grantDraft, setGrantDraft] = useState<GrantDraft>({
    module: 'crm',
    resource: '*',
    action: 'view',
    scope: 'ALL'
  });
  const [busy, setBusy] = useState(false);
  const canEdit = ['OWNER', 'ADMIN'].includes(role ?? '');

  const refresh = async (): Promise<TenantRole[]> => {
    const response = await apiFetch(`${API}/tenant/roles`);
    if (!response.ok) throw new Error('Could not load workspace roles');
    const data: TenantRole[] = await response.json();
    setRoles(data);
    return data;
  };

  useEffect(() => {
    if (canEdit) void refresh().catch((error: unknown) => notify(errorMessage(error)));
  }, [canEdit]);

  const selected = roles.find((item) => item.roleCode === selectedCode && !item.systemRole);

  useEffect(() => {
    setDraft(selected?.permissions || []);
  }, [selectedCode]);

  const createRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      roleCode: String(form.get('roleCode') || '').toUpperCase(),
      displayName: form.get('displayName'),
      description: form.get('description'),
      cloneFrom: form.get('cloneFrom') || null
    };
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw await responseError(response, 'Could not create role');
      const body: TenantRole = await response.json();
      await refresh();
      setSelectedCode(body.roleCode);
      formElement.reset();
      notify('Custom role created. Review its permissions before assigning it.');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const addGrant = (): void => {
    const resource = String(grantDraft.resource || '*').trim() || '*';
    const leadEligible =
      grantDraft.module === 'crm' && resource.toLowerCase() === 'leads' && grantDraft.action !== '*';
    const cycleEligible =
      grantDraft.module === 'inventory' &&
      resource.toLowerCase() === 'cycle-counts' &&
      grantDraft.action !== '*';
    const scopeEligible =
      (leadEligible || cycleEligible) && ['ALL', 'OWN', 'TEAM', 'BRANCH'].includes(grantDraft.scope);
    const grant = { ...grantDraft, resource, scope: scopeEligible ? grantDraft.scope : 'ALL' };
    if (
      !draft.some(
        (row) =>
          row.module === grant.module &&
          row.resource === grant.resource &&
          row.action === grant.action &&
          row.scope === grant.scope
      )
    ) {
      setDraft((rows) => [...rows, grant]);
    }
  };

  const saveRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch(`${API}/tenant/roles/${selected.roleCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleCode: selected.roleCode,
          displayName: form.get('displayName'),
          description: form.get('description'),
          permissions: draft
        })
      });
      if (!response.ok) throw await responseError(response, 'Could not save role');
      await response.json();
      await refresh();
      notify('Role and permissions saved successfully');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteRole = async (): Promise<void> => {
    if (
      !selected ||
      !window.confirm(`Delete the ${selected.displayName} role? Active members must be reassigned first.`)
    )
      return;
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/roles/${selected.roleCode}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw await responseError(response, 'Could not delete role');
      await response.json();
      setSelectedCode('');
      await refresh();
      notify('Custom role deleted successfully');
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) return null;

  const leadScopeAvailable =
    grantDraft.module === 'crm' && grantDraft.resource.trim().toLowerCase() === 'leads' && grantDraft.action !== '*';
  const cycleCountScopeAvailable =
    grantDraft.module === 'inventory' &&
    grantDraft.resource.trim().toLowerCase() === 'cycle-counts' &&
    grantDraft.action !== '*';

  const updateModule = (module: string): void =>
    setGrantDraft((current) => {
      const valid =
        (module === 'crm' && current.resource.trim().toLowerCase() === 'leads') ||
        (module === 'inventory' && current.resource.trim().toLowerCase() === 'cycle-counts');
      return { ...current, module, ...(!valid ? { scope: 'ALL' } : {}) };
    });

  const updateResource = (resource: string): void =>
    setGrantDraft((current) => {
      const normalized = resource.trim().toLowerCase();
      const valid =
        (current.module === 'crm' && normalized === 'leads') ||
        (current.module === 'inventory' && normalized === 'cycle-counts');
      return { ...current, resource, ...(!valid ? { scope: 'ALL' } : {}) };
    });

  return (
    <div className="settings-grid-2col">
      {/* Column 1: Roles Directory & New Role Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* System Roles Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={13} style={{ color: 'var(--sp-text-muted)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                System built-in roles
              </span>
            </div>
            <span className="sales-status-pill green">Enforced</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roles
              .filter((item) => item.systemRole)
              .map((item) => (
                <div key={item.roleCode} className="reports-saved-card">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--sp-text)' }}>
                      {item.displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                      <code>{item.roleCode}</code> · {item.description}
                    </div>
                  </div>
                  <span className="sales-subnav-badge">
                    {item.permissions.length} grants
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Create Custom Role Workbench */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Create custom role
            </span>
            <Plus size={13} style={{ color: 'var(--sp-brand)' }} />
          </div>

          <form onSubmit={createRole} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="settings-field-group">
              <label className="settings-field-label">
                Role code <span className="required-dot">*</span>
              </label>
              <input
                name="roleCode"
                required
                maxLength={24}
                pattern="[A-Za-z][A-Za-z0-9_]{1,23}"
                className="sales-text-input"
                placeholder="e.g. SALES_LEAD"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Role display name <span className="required-dot">*</span>
              </label>
              <input
                name="displayName"
                required
                maxLength={80}
                className="sales-text-input"
                placeholder="e.g. Sales Team Lead"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">Description</label>
              <input
                name="description"
                maxLength={240}
                className="sales-text-input"
                placeholder="Manages quotes, pipeline, and customer follow-ups"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">Clone permissions from</label>
              <select name="cloneFrom" className="sales-select-input" defaultValue="">
                <option value="">Start empty (no grants)</option>
                {roles.map((item) => (
                  <option key={item.roleCode} value={item.roleCode}>
                    {item.displayName} ({item.roleCode})
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="sales-action-btn primary" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
              <Plus size={12} />
              <span>{busy ? 'Creating…' : 'Create Custom Role'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Column 2: Role Permissions Studio */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Custom role permissions studio</h3>
            <p>Select a custom role and fine-tune its module, resource, and scope rules.</p>
          </div>
        </div>

        <div className="settings-field-group">
          <label className="settings-field-label">Custom role to configure</label>
          <select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="sales-select-input"
            style={{ width: '100%', fontWeight: 600 }}
          >
            <option value="">Select a custom role to edit…</option>
            {roles
              .filter((item) => !item.systemRole)
              .map((item) => (
                <option key={item.roleCode} value={item.roleCode}>
                  {item.displayName} ({item.roleCode})
                </option>
              ))}
          </select>
        </div>

        {selected ? (
          <form onSubmit={saveRole} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
            <div className="settings-form-row">
              <div className="settings-field-group">
                <label className="settings-field-label">
                  Role display name <span className="required-dot">*</span>
                </label>
                <input
                  name="displayName"
                  required
                  maxLength={80}
                  className="sales-text-input"
                  value={selected.displayName}
                  onChange={(e) =>
                    setRoles((rows) =>
                      rows.map((r) => (r.roleCode === selectedCode ? { ...r, displayName: e.target.value } : r))
                    )
                  }
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Description</label>
                <input
                  name="description"
                  maxLength={240}
                  className="sales-text-input"
                  value={selected.description}
                  onChange={(e) =>
                    setRoles((rows) =>
                      rows.map((r) => (r.roleCode === selectedCode ? { ...r, description: e.target.value } : r))
                    )
                  }
                />
              </div>
            </div>

            {/* Grants List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="settings-field-label" style={{ margin: 0, fontWeight: 600 }}>
                  Active permission grants ({draft.length})
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {draft.length > 0 ? (
                  draft.map((grant, index) => (
                    <div
                      key={`${grant.module}-${grant.resource}-${grant.action}-${grant.scope}`}
                      className="reports-saved-card"
                      style={{ padding: '8px 12px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="facility-code-pill" style={{ textTransform: 'uppercase' }}>
                          {grant.module}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
                          {grant.resource} · {grant.action}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                          ({scopeLabels[grant.scope] || grant.scope})
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sales-action-btn secondary danger"
                        style={{ height: '22px', width: '22px', padding: 0, justifyContent: 'center' }}
                        onClick={() => setDraft((rows) => rows.filter((_, idx) => idx !== index))}
                        title="Remove grant"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '8px 0', textAlign: 'center' }}>
                    No permissions assigned to this role yet.
                  </p>
                )}
              </div>
            </div>

            {/* Add Grant Bar */}
            <div
              style={{
                background: 'var(--sp-surface-subtle)',
                border: '1px solid var(--sp-border)',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'grid',
                gridTemplateColumns: leadScopeAvailable || cycleCountScopeAvailable ? '1fr 1fr 1fr 1fr auto' : '1fr 1fr 1fr auto',
                gap: '8px',
                alignItems: 'end'
              }}
            >
              <div className="settings-field-group">
                <label className="settings-field-label" style={{ fontSize: '11px' }}>Module</label>
                <select
                  value={grantDraft.module}
                  onChange={(e) => updateModule(e.target.value)}
                  className="sales-select-input"
                  style={{ height: '28px', fontSize: '11px' }}
                >
                  {modules.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label" style={{ fontSize: '11px' }}>Resource</label>
                <input
                  value={grantDraft.resource}
                  onChange={(e) => updateResource(e.target.value)}
                  className="sales-text-input"
                  style={{ height: '28px', fontSize: '11px' }}
                  placeholder="*"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label" style={{ fontSize: '11px' }}>Action</label>
                <select
                  value={grantDraft.action}
                  onChange={(e) =>
                    setGrantDraft((v) => ({
                      ...v,
                      action: e.target.value,
                      ...(e.target.value === '*' ? { scope: 'ALL' } : {})
                    }))
                  }
                  className="sales-select-input"
                  style={{ height: '28px', fontSize: '11px' }}
                >
                  {actions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {(leadScopeAvailable || cycleCountScopeAvailable) && (
                <div className="settings-field-group">
                  <label className="settings-field-label" style={{ fontSize: '11px' }}>Scope</label>
                  <select
                    value={grantDraft.scope}
                    onChange={(e) => setGrantDraft((v) => ({ ...v, scope: e.target.value }))}
                    className="sales-select-input"
                    style={{ height: '28px', fontSize: '11px' }}
                  >
                    <option value="ALL">All records</option>
                    <option value="OWN">My records</option>
                    <option value="TEAM">Direct reports</option>
                    <option value="BRANCH">Assigned branch</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={addGrant}
                style={{ height: '28px', fontSize: '11px' }}
              >
                Add Rule
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--sp-border)' }}>
              <button type="submit" className="sales-action-btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save Role Permissions'}
              </button>

              <button
                type="button"
                className="sales-action-btn secondary danger"
                disabled={busy}
                onClick={() => void deleteRole()}
              >
                Delete Role
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12.5px' }}>
            Select a custom role above to edit its identity and permission grants matrix.
          </div>
        )}
      </div>
    </div>
  );
}
