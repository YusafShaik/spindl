import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatBytes } from '../../lib/utils/currency';

interface SupportRequest {
  id: string;
  tenantName: string;
  reason: string;
  durationMinutes: number;
  status: string;
  expiresAt: string | null;
}

interface ModuleDiagnostic { code: string; entitled: boolean; enabled: boolean; }
interface SupportDiagnostics {
  workspace: string;
  accountStatus: string;
  timezone: string;
  countryCode: string;
  currencyCode: string;
  planCode: string;
  planVersion: number;
  subscriptionStatus: string;
  activeSeats: number;
  pendingInvitations: number;
  seatLimit: number;
  storageUsedBytes: number;
  storageLimitMb: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
  consentExpiresAt: string;
  modules: ModuleDiagnostic[];
}

function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

export function PlatformSupportPanel({ notify }: { notify: (message: string) => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [diagnostics, setDiagnostics] = useState<SupportDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/platform/support-requests`);
    if (response.status === 403) { setAllowed(false); return; }
    if (!response.ok) throw new Error('Could not load support requests');
    const data: SupportRequest[] = await response.json();
    setRequests(data);
    setAllowed(true);
  };
  useEffect(() => { void load().catch((error: unknown) => notify(getErrorMessage(error))); }, []);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/support-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: form.get('tenantId'), reason: form.get('reason'), durationMinutes: Number(form.get('durationMinutes')) }) });
      if (!response.ok) throw await responseError(response, 'Could not request tenant support access');
      await response.json();
      formElement.reset();
      await load();
      notify('Consent request sent to the workspace owners');
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setBusy(false); }
  };

  const openDiagnostics = async (id: string): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/support-requests/${id}/diagnostics`);
      if (!response.ok) throw await responseError(response, 'Support consent is missing or expired');
      setDiagnostics(await response.json());
    } catch (error) { notify(getErrorMessage(error)); }
    finally { setBusy(false); }
  };

  if (!allowed) return null;
  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">Platform support</h2>
          <p className="sales-card-subtitle">Request explicit consent for a time-limited diagnostics view. This does not impersonate a workspace member or grant access to business records.</p>
        </div>
      </div>
      <form className="tenant-settings-form" onSubmit={(event) => void create(event)}>
        <label>
          Workspace ID
          <input name="tenantId" required placeholder="Workspace UUID" />
        </label>
        <label>
          Support reason
          <input name="reason" required maxLength={500} placeholder="Describe the issue to investigate" />
        </label>
        <label>
          Access duration
          <select name="durationMinutes" defaultValue="30">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>
        <button className="sales-action-btn primary" disabled={busy}>
          {busy ? 'Sending…' : 'Request consent'}
        </button>
      </form>
      {requests.map((request) => (
        <div className="team-invite-link" key={request.id}>
          <div>
            <b>{request.tenantName} · {request.status}</b>
            <small>{request.reason} · {request.durationMinutes} minutes{request.expiresAt ? ` · expires ${new Date(request.expiresAt).toLocaleString()}` : ''}</small>
          </div>
          {request.status === 'APPROVED' && (
            <button className="sales-action-btn secondary" disabled={busy} onClick={() => void openDiagnostics(request.id)}>
              View diagnostics
            </button>
          )}
        </div>
      ))}
      {diagnostics && (
        <div className="tenant-support-diagnostics">
          <div className="sales-card-header">
            <div>
              <h3 className="sales-card-title">{diagnostics.workspace} diagnostics</h3>
              <p className="sales-card-subtitle">Consent expires {new Date(diagnostics.consentExpiresAt).toLocaleString()}</p>
            </div>
            <button className="sales-action-btn secondary" onClick={() => setDiagnostics(null)}>
              Close
            </button>
          </div>
          <div className="tenant-settings-meta">
            <div><small>ACCOUNT</small><b>{diagnostics.accountStatus}</b></div>
            <div><small>PLAN</small><b>{diagnostics.planCode} · v{diagnostics.planVersion} · {diagnostics.subscriptionStatus}</b></div>
            <div><small>SEATS</small><b>{diagnostics.activeSeats} active · {diagnostics.pendingInvitations} pending · {diagnostics.seatLimit} limit</b></div>
            <div><small>STORAGE</small><b>{formatBytes(diagnostics.storageUsedBytes)} / {diagnostics.storageLimitMb} MB</b></div>
            <div><small>API USAGE</small><b>{Number(diagnostics.apiCallsUsed).toLocaleString()} / {Number(diagnostics.apiCallsLimit).toLocaleString()}</b></div>
            <div><small>LOCALE</small><b>{diagnostics.countryCode} · {diagnostics.currencyCode} · {diagnostics.timezone}</b></div>
          </div>
          <div className="tenant-modules-grid">
            {diagnostics.modules.map((module) => (
              <article className="tenant-module-card" key={module.code}>
                <div><b>{module.code}</b><small>{module.entitled ? 'Entitled' : 'Not entitled'}</small></div>
                <span className={`module-state ${module.enabled ? 'enabled' : ''}`}>{module.enabled ? 'Enabled' : 'Disabled'}</span>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
