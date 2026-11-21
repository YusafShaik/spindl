import { useEffect, useState, type FormEvent } from 'react';
import { Building2, MapPin, Plus, Shield } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';

interface TenantBranchesPanelProps {
  role?: string;
  notify: (message: string) => void;
}

interface TenantBranchRecord {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  taxRegistration: string | null;
  active: boolean;
  defaultBranch: boolean;
}

export function TenantBranchesPanel({ role, notify }: TenantBranchesPanelProps) {
  const [branches, setBranches] = useState<TenantBranchRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const canEdit = role !== undefined && ['OWNER', 'ADMIN'].includes(role);

  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/tenant/branches`);
    if (!response.ok) throw new Error('Could not load workspace branches');
    setBranches(await response.json());
  };

  useEffect(() => {
    if (canEdit) {
      load().catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
    }
  }, [canEdit]);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: String(form.get('code') || '').trim().toUpperCase(),
          name: String(form.get('name') || '').trim(),
          legalName: form.get('legalName') || null,
          taxRegistration: form.get('taxRegistration') || null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not create branch');
      element.reset();
      await load();
      notify('Enterprise branch registered successfully');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (branch: TenantBranchRecord): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/branches/${branch.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !branch.active })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not update branch');
      await load();
      notify(branch.active ? 'Branch deactivated' : 'Branch activated');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) return null;

  return (
    <div className="settings-grid-2col">
      {/* Column 1: Add Branch Form */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Register workspace branch</h3>
            <p>Add a regional business office, subsidiary entity, or state operational unit.</p>
          </div>
          <span className="sales-status-pill blue">{branches.length} Registered</span>
        </div>

        <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="settings-form-row">
            <div className="settings-field-group">
              <label className="settings-field-label">
                Branch code <span className="required-dot">*</span>
              </label>
              <input
                name="code"
                required
                maxLength={40}
                className="sales-text-input"
                placeholder="e.g. NORTH"
                style={{ textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Branch display name <span className="required-dot">*</span>
              </label>
              <input
                name="name"
                required
                maxLength={120}
                className="sales-text-input"
                placeholder="e.g. North Regional Office"
              />
            </div>
          </div>

          <div className="settings-form-row">
            <div className="settings-field-group">
              <label className="settings-field-label">Legal business entity name</label>
              <input
                name="legalName"
                maxLength={180}
                className="sales-text-input"
                placeholder="Official incorporated name"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">Tax registration / GSTIN</label>
              <input
                name="taxRegistration"
                maxLength={80}
                className="sales-text-input"
                placeholder="e.g. 07AAAAA0000A1Z5"
              />
            </div>
          </div>

          <div className="reports-note-box" style={{ margin: 0, fontSize: '11.5px' }}>
            Warehouses and inventory allocations can be scoped to distinct branches. The primary default branch is preserved for backward-compatible records.
          </div>

          <div className="settings-form-footer">
            <button type="submit" className="sales-action-btn primary" disabled={busy}>
              <Plus size={12} />
              <span>{busy ? 'Saving…' : 'Register branch'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Column 2: Branches Register List */}
      <div className="settings-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--sp-border)', background: 'var(--sp-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
              Active workspace branches
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              {branches.length} locations active in tenant
            </p>
          </div>
          <span className="sales-status-pill green">Operational</span>
        </div>

        <div className="table-scroll" style={{ margin: 0 }}>
          <table className="reports-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Code</th>
                <th style={{ width: '40%' }}>Branch name</th>
                <th style={{ width: '20%' }}>Status</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="sales-row">
                  <td>
                    <span className="facility-code-pill">{branch.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                      {branch.name}
                    </div>
                    {branch.legalName && (
                      <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '1px' }}>
                        {branch.legalName}
                      </div>
                    )}
                  </td>
                  <td>
                    {branch.defaultBranch ? (
                      <span className="default-hub-badge">Default Hub</span>
                    ) : (
                      <Status label={branch.active ? 'Active' : 'Inactive'} />
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!branch.defaultBranch && (
                      <button
                        type="button"
                        className={`sales-action-btn ${branch.active ? 'secondary danger' : 'secondary'}`}
                        disabled={busy}
                        onClick={() => setActive(branch)}
                        style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                      >
                        {branch.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
