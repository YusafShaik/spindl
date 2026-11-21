import { useEffect, useState, type FormEvent } from 'react';
import { ShieldAlert, Plus, Layers, Check } from 'lucide-react';
import { Status } from '../../components/ui/Status';
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

interface ModuleDiagnostic {
  code: string;
  entitled: boolean;
  enabled: boolean;
}

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    if (response.status === 403) {
      setAllowed(false);
      return;
    }
    if (!response.ok) throw new Error('Could not load support requests');
    const data: SupportRequest[] = await response.json();
    setRequests(data);
    setAllowed(true);
  };

  useEffect(() => {
    void load().catch((error: unknown) => notify(getErrorMessage(error)));
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/support-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: form.get('tenantId'),
          reason: form.get('reason'),
          durationMinutes: Number(form.get('durationMinutes'))
        })
      });
      if (!response.ok) throw await responseError(response, 'Could not request tenant support access');
      await response.json();
      formElement.reset();
      await load();
      notify('Consent request sent to the workspace owners');
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openDiagnostics = async (id: string): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/support-requests/${id}/diagnostics`);
      if (!response.ok) throw await responseError(response, 'Support consent is missing or expired');
      setDiagnostics(await response.json());
    } catch (error) {
      notify(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <div className="reports-workbench-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Platform Operational Support Request
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
            Request explicit user consent for a time-limited diagnostics view. Does not impersonate members or access business data.
          </p>
        </div>
      </div>

      <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
        <div>
          <label className="settings-field-label">Workspace UUID</label>
          <input name="tenantId" required className="sales-text-input" placeholder="e.g. 86346062-…" />
        </div>

        <div>
          <label className="settings-field-label">Support reason</label>
          <input name="reason" required maxLength={500} className="sales-text-input" placeholder="Describe the issue under investigation" />
        </div>

        <div>
          <label className="settings-field-label">Duration</label>
          <select name="durationMinutes" defaultValue="30" className="sales-select-input">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>

        <button type="submit" className="sales-action-btn primary" disabled={busy} style={{ height: '32px' }}>
          {busy ? 'Sending…' : 'Request Access'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        {requests.map((request) => (
          <div key={request.id} className="reports-saved-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <b style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>{request.tenantName}</b>
                <Status label={request.status} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {request.reason} · {request.durationMinutes} min
                {request.expiresAt ? ` · expires ${new Date(request.expiresAt).toLocaleString()}` : ''}
              </span>
            </div>
            {request.status === 'APPROVED' && (
              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={busy}
                onClick={() => void openDiagnostics(request.id)}
                style={{ height: '26px', fontSize: '11px' }}
              >
                View Diagnostics
              </button>
            )}
          </div>
        ))}
      </div>

      {diagnostics && (
        <div style={{ marginTop: '14px', padding: '14px', background: 'var(--sp-surface-subtle)', borderRadius: '8px', border: '1px solid var(--sp-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{diagnostics.workspace} Diagnostics</h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Consent expires {new Date(diagnostics.consentExpiresAt).toLocaleString()}
              </p>
            </div>
            <button type="button" className="sales-action-btn secondary" onClick={() => setDiagnostics(null)}>
              Close Diagnostics
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11.5px' }}>
            <div style={{ padding: '6px 10px', background: 'var(--sp-surface)', borderRadius: '4px', border: '1px solid var(--sp-border)' }}>
              <span style={{ color: 'var(--sp-text-muted)', fontSize: '10px' }}>Account / Tier</span>
              <div style={{ fontWeight: 600 }}>{diagnostics.accountStatus} · {diagnostics.planCode}</div>
            </div>
            <div style={{ padding: '6px 10px', background: 'var(--sp-surface)', borderRadius: '4px', border: '1px solid var(--sp-border)' }}>
              <span style={{ color: 'var(--sp-text-muted)', fontSize: '10px' }}>Seats & storage</span>
              <div style={{ fontWeight: 600 }}>{diagnostics.activeSeats}/{diagnostics.seatLimit} seats · {formatBytes(diagnostics.storageUsedBytes)}</div>
            </div>
            <div style={{ padding: '6px 10px', background: 'var(--sp-surface)', borderRadius: '4px', border: '1px solid var(--sp-border)' }}>
              <span style={{ color: 'var(--sp-text-muted)', fontSize: '10px' }}>Locale</span>
              <div style={{ fontWeight: 600 }}>{diagnostics.countryCode} · {diagnostics.currencyCode} · {diagnostics.timezone}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
