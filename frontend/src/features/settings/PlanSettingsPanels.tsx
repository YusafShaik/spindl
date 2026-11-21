import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { formatBytes } from '../../lib/utils/currency';

interface PlanSummary {
  planCode: string;
  version: number;
  displayName: string;
  status: string;
  seatLimit: number;
  activeSeats: number;
  pendingInvitations: number;
  storageLimitMb: number;
  storageUsedBytes: number;
  apiCallsPerMonth: number;
  apiCallsUsed: number;
}

interface PlanPreview {
  currentPlanCode: string;
  currentVersion: number;
  targetPlanCode: string;
  targetVersion: number;
  targetPlanName: string;
  targetSeatLimit: number;
  seatsInUse: number;
  storageLimitMb: number;
  storageUsedBytes: number;
  apiCallsPerMonth: number;
  apiCallsUsed: number;
  overages: string[];
  blockedModules: string[];
  effectiveDate: string;
  message: string;
}

interface PlanRequest {
  id: string;
  currentPlanCode: string;
  targetPlanCode: string;
  effectiveDate: string;
  status: string;
  requestedAt: string;
  reviewNote: string | null;
  appliedAt: string | null;
}

interface PlatformPlanRequest extends PlanRequest {
  tenantName: string;
}

interface PlanSettingsPanelsProps {
  role?: string;
  notify: (message: string) => void;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.message || fallback);
}

export function PlanUsagePanel({ role, notify }: PlanSettingsPanelsProps) {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [choice, setChoice] = useState('TRIAL');
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const canEdit = ['OWNER', 'ADMIN'].includes(role ?? '');

  useEffect(() => {
    let active = true;
    apiFetch(`${API}/tenant/settings/plan`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Could not load workspace plan'))
      )
      .then((value: PlanSummary) => {
        if (active) {
          setPlan(value);
          setChoice(value.planCode);
        }
      })
      .catch((error: unknown) => notify(messageFrom(error)));
    return () => {
      active = false;
    };
  }, []);

  const loadRequests = async (): Promise<void> => {
    if (!canEdit) return;
    const response = await apiFetch(`${API}/tenant/settings/plan-requests`);
    if (!response.ok) throw new Error('Could not load plan change requests');
    const data: PlanRequest[] = await response.json();
    setRequests(data);
  };

  useEffect(() => {
    void loadRequests().catch((error: unknown) => notify(messageFrom(error)));
  }, [role]);

  const showPreview = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: choice })
      });
      if (!response.ok) throw await responseError(response, 'Could not preview plan');
      setPreview(await response.json());
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const requestPlan = async (): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: choice })
      });
      if (!response.ok) throw await responseError(response, 'Could not submit plan request');
      await response.json();
      await loadRequests();
      notify('Plan change request sent for commercial review');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelPlanRequest = async (id: string): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-requests/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw await responseError(response, 'Could not cancel plan request');
      await response.json();
      await loadRequests();
      notify('Plan change request cancelled');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reports-workbench-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Enterprise Subscription & Usage
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--sp-text-muted)' }}>
            {plan ? `${plan.displayName} (v${plan.version}) · Current Billing Tier` : 'Loading plan…'}
          </p>
        </div>
        {plan && <Status label={plan.status} />}
      </div>

      {plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Telemetry Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div className="reports-saved-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                SEATS CONSUMPTION
              </span>
              <b style={{ fontSize: '15px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                {plan.activeSeats} / {plan.seatLimit} Seats
              </b>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                {plan.pendingInvitations} invited pending
              </span>
            </div>

            <div className="reports-saved-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                STORAGE UTILIZATION
              </span>
              <b style={{ fontSize: '15px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(plan.storageUsedBytes)} / {plan.storageLimitMb.toLocaleString()} MB
              </b>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Files, documents & attachments
              </span>
            </div>

            <div className="reports-saved-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
                API DISPATCH VOLUME
              </span>
              <b style={{ fontSize: '15px', color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                {Number(plan.apiCallsUsed || 0).toLocaleString()} / {plan.apiCallsPerMonth.toLocaleString()}
              </b>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Monthly webhook & token calls
              </span>
            </div>
          </div>

          {/* Plan Comparison & Request */}
          <form
            onSubmit={(event) => void showPreview(event)}
            style={{
              background: 'var(--sp-surface-subtle)',
              border: '1px solid var(--sp-border)',
              borderRadius: '6px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1 }}>
              <label className="settings-field-label">Evaluate or change subscription tier</label>
              <select
                value={choice}
                onChange={(event) => {
                  setChoice(event.target.value);
                  setPreview(null);
                }}
                className="sales-select-input"
                style={{ width: '100%' }}
              >
                {[
                  ['TRIAL', 'Trial Tier'],
                  ['STARTER_CRM', 'Starter CRM'],
                  ['INVENTORY_LITE', 'Inventory Lite'],
                  ['COMMERCE_OPS', 'Commerce Ops'],
                  ['MANUFACTURING', 'Manufacturing Standard']
                ].map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="sales-action-btn secondary"
              disabled={saving || !canEdit}
              style={{ height: '32px' }}
            >
              {saving ? 'Calculating…' : 'Preview Tier Impact'}
            </button>
          </form>

          {preview && (
            <div
              className="reports-saved-card"
              style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                background: 'var(--sp-surface-subtle)',
                borderLeft: '3px solid var(--sp-brand)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b style={{ fontSize: '13px', color: 'var(--sp-text)' }}>
                  Target: {preview.targetPlanName} · Effective {preview.effectiveDate}
                </b>
                <span className="sales-status-pill blue">Simulation Ready</span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-secondary)', lineHeight: '1.45' }}>
                {preview.message} Target limits: {preview.targetSeatLimit} seats, {preview.storageLimitMb.toLocaleString()} MB storage, {preview.apiCallsPerMonth.toLocaleString()} calls/mo.
                {preview.overages.length ? ` Overages: ${preview.overages.join('; ')}.` : ' No quota overages.'}
                {preview.blockedModules?.length ? ` Modules to disable: ${preview.blockedModules.join(', ')}.` : ''}
              </p>
              {canEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="sales-action-btn primary"
                    disabled={
                      saving ||
                      requests.some((r) => ['REQUESTED', 'APPROVED'].includes(r.status)) ||
                      (preview.targetPlanCode === preview.currentPlanCode &&
                        preview.targetVersion === preview.currentVersion)
                    }
                    onClick={() => void requestPlan()}
                  >
                    {requests.some((r) => ['REQUESTED', 'APPROVED'].includes(r.status))
                      ? 'Request Pending Commercial Review'
                      : 'Submit Upgrade / Change Request'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pending Plan Change Requests */}
          {requests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="settings-field-label" style={{ margin: 0, fontWeight: 600 }}>
                Submitted plan requests
              </span>
              {requests.map((request) => (
                <div key={request.id} className="reports-saved-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <b style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                        {request.targetPlanCode.replaceAll('_', ' ')}
                      </b>
                      <Status label={request.status} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                      {request.currentPlanCode.replaceAll('_', ' ')} → {request.targetPlanCode.replaceAll('_', ' ')} · effective {request.effectiveDate} · submitted {new Date(request.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {request.status === 'REQUESTED' && canEdit && (
                    <button
                      type="button"
                      className="sales-action-btn secondary danger"
                      disabled={saving}
                      onClick={() => void cancelPlanRequest(request.id)}
                      style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlatformPlanReviewPanel({ notify }: Omit<PlanSettingsPanelsProps, 'role'>) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<PlatformPlanRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/platform/plan-requests`);
    if (response.status === 403) {
      setAllowed(false);
      return;
    }
    if (!response.ok) throw new Error('Could not load platform plan review queue');
    const data: PlatformPlanRequest[] = await response.json();
    setRequests(data);
    setAllowed(true);
  };

  useEffect(() => {
    void load().catch((error: unknown) => notify(messageFrom(error)));
  }, []);

  const review = async (id: string, action: 'approve' | 'reject'): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/plan-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: notes[id] || null })
      });
      if (!response.ok) throw await responseError(response, `Could not ${action} request`);
      const body: { status: string } = await response.json();
      await load();
      notify(
        action === 'approve'
          ? body.status === 'APPLIED'
            ? 'Plan approved and applied'
            : 'Plan approved and scheduled'
          : 'Plan request rejected'
      );
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed || !requests.length) return null;

  return (
    <div className="reports-workbench-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Platform Commercial Review Queue
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
            Review and adjudicate tier change requests across workspaces.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {requests.map((request) => (
          <div key={request.id} className="reports-saved-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>
                {request.tenantName} · {request.currentPlanCode} → {request.targetPlanCode}
              </b>
              <Status label={request.status} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Effective {request.effectiveDate} · Requested {new Date(request.requestedAt).toLocaleString()}
            </span>
            {request.status === 'REQUESTED' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  value={notes[request.id] || ''}
                  onChange={(e) => setNotes((curr) => ({ ...curr, [request.id]: e.target.value }))}
                  maxLength={500}
                  className="sales-text-input"
                  style={{ flex: 1, height: '28px', fontSize: '11.5px' }}
                  placeholder="Review note (required for rejection)"
                />
                <button
                  type="button"
                  className="sales-action-btn primary"
                  disabled={busy}
                  onClick={() => void review(request.id, 'approve')}
                  style={{ height: '28px', fontSize: '11.5px' }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="sales-action-btn secondary danger"
                  disabled={busy}
                  onClick={() => void review(request.id, 'reject')}
                  style={{ height: '28px', fontSize: '11.5px' }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
