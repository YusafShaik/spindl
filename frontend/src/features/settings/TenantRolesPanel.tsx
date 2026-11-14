import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';

interface RoleGrant { module: string; resource: string; action: string; scope: string; }
interface TenantRole {
  id: string;
  roleCode: string;
  displayName: string;
  description: string;
  systemRole: boolean;
  permissions: RoleGrant[];
}
interface GrantDraft extends RoleGrant {}

const modules = ['dashboard', 'crm', 'catalog', 'inventory', 'sales', 'purchasing', 'manufacturing', 'quality', 'finance', 'imports', 'team', 'operations', 'tenant'];
const actions = ['view', 'create', 'edit', 'approve', 'export', 'import', 'delete', 'assign', 'adjust', 'pay', 'credit', 'receive', 'return', 'fulfill', 'release', 'issue', 'start', 'complete'];
const scopeLabels: Record<string, string> = { OWN: 'Owned records', TEAM: 'My direct reports', BRANCH: 'Assigned branches', ALL: 'All records' };

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

export function TenantRolesPanel({ role, notify }: { role?: string; notify: (message: string) => void }) {
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [draft, setDraft] = useState<RoleGrant[]>([]);
  const [grantDraft, setGrantDraft] = useState<GrantDraft>({ module: 'crm', resource: '*', action: 'view', scope: 'ALL' });
  const [busy, setBusy] = useState(false);
  const canEdit = ['OWNER', 'ADMIN'].includes(role ?? '');

  const refresh = async (): Promise<TenantRole[]> => {
    const response = await apiFetch(`${API}/tenant/roles`);
    if (!response.ok) throw new Error('Could not load workspace roles');
    const data: TenantRole[] = await response.json();
    setRoles(data);
    return data;
  };
  useEffect(() => { if (canEdit) void refresh().catch((error: unknown) => notify(errorMessage(error))); }, [canEdit]);
  const selected = roles.find((item) => item.roleCode === selectedCode && !item.systemRole);
  useEffect(() => { setDraft(selected?.permissions || []); }, [selectedCode]);

  const createRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = { roleCode: String(form.get('roleCode') || '').toUpperCase(), displayName: form.get('displayName'), description: form.get('description'), cloneFrom: form.get('cloneFrom') || null };
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw await responseError(response, 'Could not create role');
      const body: TenantRole = await response.json();
      await refresh();
      setSelectedCode(body.roleCode);
      formElement.reset();
      notify('Custom role created. Review its permissions before assigning it.');
    } catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const addGrant = (): void => {
    const resource = String(grantDraft.resource || '*').trim() || '*';
    const leadEligible = grantDraft.module === 'crm' && resource.toLowerCase() === 'leads' && grantDraft.action !== '*';
    const cycleEligible = grantDraft.module === 'inventory' && resource.toLowerCase() === 'cycle-counts' && grantDraft.action !== '*';
    const scopeEligible = (leadEligible || cycleEligible) && ['ALL', 'OWN', 'TEAM', 'BRANCH'].includes(grantDraft.scope);
    const grant = { ...grantDraft, resource, scope: scopeEligible ? grantDraft.scope : 'ALL' };
    if (!draft.some((row) => row.module === grant.module && row.resource === grant.resource && row.action === grant.action && row.scope === grant.scope)) setDraft((rows) => [...rows, grant]);
  };

  const saveRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch(`${API}/tenant/roles/${selected.roleCode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleCode: selected.roleCode, displayName: form.get('displayName'), description: form.get('description'), permissions: draft }) });
      if (!response.ok) throw await responseError(response, 'Could not save role');
      await response.json();
      await refresh();
      notify('Role and permissions saved');
    } catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const deleteRole = async (): Promise<void> => {
    if (!selected || !window.confirm(`Delete the ${selected.displayName} role? Active members must be reassigned first.`)) return;
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/roles/${selected.roleCode}`, { method: 'DELETE' });
      if (!response.ok) throw await responseError(response, 'Could not delete role');
      await response.json();
      setSelectedCode('');
      await refresh();
      notify('Custom role deleted');
    } catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };

  if (!canEdit) return null;
  const leadScopeAvailable = grantDraft.module === 'crm' && grantDraft.resource.trim().toLowerCase() === 'leads' && grantDraft.action !== '*';
  const cycleCountScopeAvailable = grantDraft.module === 'inventory' && grantDraft.resource.trim().toLowerCase() === 'cycle-counts' && grantDraft.action !== '*';
  const updateModule = (module: string): void => setGrantDraft((current) => {
    const valid = module === 'crm' && current.resource.trim().toLowerCase() === 'leads' || module === 'inventory' && current.resource.trim().toLowerCase() === 'cycle-counts';
    return { ...current, module, ...(!valid ? { scope: 'ALL' } : {}) };
  });
  const updateResource = (resource: string): void => setGrantDraft((current) => {
    const normalized = resource.trim().toLowerCase();
    const valid = current.module === 'crm' && normalized === 'leads' || current.module === 'inventory' && normalized === 'cycle-counts';
    return { ...current, resource, ...(!valid ? { scope: 'ALL' } : {}) };
  });

  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Workspace roles</h2><p>Clone a built-in role and customize its permissions. Tenant role administration is restricted to owners and admins.</p></div></div>
    <form className="tenant-settings-form" onSubmit={(event) => void createRole(event)}><label>Role code<input name="roleCode" required maxLength={24} pattern="[A-Za-z][A-Za-z0-9_]{1,23}" placeholder="SALES_LEAD"/></label><label>Display name<input name="displayName" required maxLength={80} placeholder="Sales lead"/></label><label>Description<input name="description" maxLength={240} placeholder="Manages quotes and customer follow-up"/></label><label>Clone permissions from<select name="cloneFrom" defaultValue=""><option value="">Start with no permissions</option>{roles.map((item) => <option key={item.roleCode} value={item.roleCode}>{item.displayName} ({item.roleCode})</option>)}</select></label><button className="button button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create custom role'}</button></form>
    <div className="tenant-settings-meta">{roles.filter((item) => item.systemRole).map((item) => <div key={item.roleCode}><small>{item.roleCode}</small><b>{item.displayName} · {item.permissions.length} permissions</b></div>)}</div>
    <label>Custom role to edit<select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}><option value="">Select a custom role</option>{roles.filter((item) => !item.systemRole).map((item) => <option key={item.roleCode} value={item.roleCode}>{item.displayName} ({item.roleCode})</option>)}</select></label>
    {selected && <form className="tenant-settings-form" onSubmit={(event) => void saveRole(event)}><label>Display name<input name="displayName" required maxLength={80} value={selected.displayName} onChange={(event) => setRoles((rows) => rows.map((row) => row.roleCode === selectedCode ? { ...row, displayName: event.target.value } : row))}/></label><label>Description<input name="description" maxLength={240} value={selected.description} onChange={(event) => setRoles((rows) => rows.map((row) => row.roleCode === selectedCode ? { ...row, description: event.target.value } : row))}/></label>
      <p className="form-note">CRM leads and inventory cycle counts support own, direct-report team, assigned-branch, and all-record scopes. Other resources require all-record access.</p>
      <div className="tenant-modules-grid">{draft.map((grant, index) => <article className="tenant-module-card" key={`${grant.module}-${grant.resource}-${grant.action}-${grant.scope}`}><div><b>{grant.module} · {grant.resource}</b><small>{grant.action} · {scopeLabels[grant.scope] || grant.scope}</small></div><button type="button" className="mini-action" onClick={() => setDraft((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></article>)}</div>
      <div className="bom-draft-line"><label>Module<select value={grantDraft.module} onChange={(event) => updateModule(event.target.value)}>{modules.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Resource<input value={grantDraft.resource} onChange={(event) => updateResource(event.target.value)} required maxLength={64} placeholder="leads or cycle-counts"/></label><label>Action<select value={grantDraft.action} onChange={(event) => setGrantDraft((value) => ({ ...value, action: event.target.value, ...(event.target.value === '*' ? { scope: 'ALL' } : {}) }))}>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{(leadScopeAvailable || cycleCountScopeAvailable) && <label>Scope<select value={grantDraft.scope} onChange={(event) => setGrantDraft((value) => ({ ...value, scope: event.target.value }))}><option value="ALL">All records</option><option value="OWN">My records</option><option value="TEAM">My direct reports</option><option value="BRANCH">Assigned branches</option></select></label>}<button type="button" className="button button-secondary" onClick={addGrant}>Add permission</button></div>
      <div className="production-form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save role'}</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => void deleteRole()}>Delete role</button></div>
    </form>}
  </section>;
}
