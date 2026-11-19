import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { formatBytes } from '../../lib/utils/currency';

interface PlanSummary {
  planCode: string; version: number; displayName: string; status: string;
  seatLimit: number; activeSeats: number; pendingInvitations: number;
  storageLimitMb: number; storageUsedBytes: number; apiCallsPerMonth: number; apiCallsUsed: number;
}

interface PlanPreview {
  currentPlanCode: string; currentVersion: number; targetPlanCode: string; targetVersion: number;
  targetPlanName: string; targetSeatLimit: number; seatsInUse: number; storageLimitMb: number;
  storageUsedBytes: number; apiCallsPerMonth: number; apiCallsUsed: number;
  overages: string[]; blockedModules: string[]; effectiveDate: string; message: string;
}

interface PlanRequest {
  id: string; currentPlanCode: string; targetPlanCode: string; effectiveDate: string;
  status: string; requestedAt: string; reviewNote: string | null; appliedAt: string | null;
}

interface PlatformPlanRequest extends PlanRequest { tenantName: string; }
interface PlanSettingsPanelsProps { role?: string; notify: (message: string) => void; }

function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

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
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load workspace plan')))
      .then((value: PlanSummary) => { if (active) { setPlan(value); setChoice(value.planCode); } })
      .catch((error: unknown) => notify(messageFrom(error)));
    return () => { active = false; };
  }, []);

  const loadRequests = async (): Promise<void> => {
    if (!canEdit) return;
    const response = await apiFetch(`${API}/tenant/settings/plan-requests`);
    if (!response.ok) throw new Error('Could not load plan change requests');
    const data: PlanRequest[] = await response.json();
    setRequests(data);
  };
  useEffect(() => { void loadRequests().catch((error: unknown) => notify(messageFrom(error))); }, [role]);

  const showPreview = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode: choice }) });
      if (!response.ok) throw await responseError(response, 'Could not preview plan');
      setPreview(await response.json());
    } catch (error) { notify(messageFrom(error)); }
    finally { setSaving(false); }
  };
  const requestPlan = async (): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode: choice }) });
      if (!response.ok) throw await responseError(response, 'Could not submit plan request');
      await response.json();
      await loadRequests();
      notify('Plan change request sent for commercial review');
    } catch (error) { notify(messageFrom(error)); }
    finally { setSaving(false); }
  };
  const cancelPlanRequest = async (id: string): Promise<void> => {
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/plan-requests/${id}`, { method: 'DELETE' });
      if (!response.ok) throw await responseError(response, 'Could not cancel plan request');
      await response.json();
      await loadRequests();
      notify('Plan change request cancelled');
    } catch (error) { notify(messageFrom(error)); }
    finally { setSaving(false); }
  };

  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">Plan and usage</h2>
          <p className="sales-card-subtitle">{plan ? `${plan.displayName} · version ${plan.version} · ${formatAuditLabel(plan.status)}` : 'Loading plan…'}</p>
        </div>
      </div>
      {plan && (
        <>
          <div className="tenant-settings-meta">
            <div>
              <small>SEATS</small>
              <b>{plan.activeSeats} active · {plan.pendingInvitations} invited · {plan.seatLimit} limit</b>
            </div>
            <div>
              <small>STORAGE USED</small>
              <b>{formatBytes(plan.storageUsedBytes)} / {plan.storageLimitMb.toLocaleString()} MB</b>
            </div>
            <div>
              <small>API USAGE THIS MONTH</small>
              <b>{Number(plan.apiCallsUsed || 0).toLocaleString()} / {plan.apiCallsPerMonth.toLocaleString()} calls</b>
            </div>
          </div>
          <form className="team-invite-form" onSubmit={(event) => void showPreview(event)}>
            <label>
              Compare a plan
              <select value={choice} onChange={(event) => { setChoice(event.target.value); setPreview(null); }}>
                {[['TRIAL', 'Trial'], ['STARTER_CRM', 'Starter CRM'], ['INVENTORY_LITE', 'Inventory Lite'], ['COMMERCE_OPS', 'Commerce Ops'], ['MANUFACTURING', 'Manufacturing']].map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </label>
            <button className="sales-action-btn secondary" disabled={saving || !canEdit}>
              {saving ? 'Calculating…' : 'Preview plan change'}
            </button>
          </form>
          {preview && (
            <div className="team-invite-link">
              <div>
                <b>{preview.targetPlanName} · effective {preview.effectiveDate}</b>
                <small>
                  {preview.message} Target limits: {preview.targetSeatLimit} seats, {preview.storageLimitMb.toLocaleString()} MB storage, {preview.apiCallsPerMonth.toLocaleString()} API calls/month. Current usage: {preview.seatsInUse} seats, {formatBytes(preview.storageUsedBytes)} storage, {Number(preview.apiCallsUsed || 0).toLocaleString()} API calls this month.
                  {preview.overages.length ? ` Overages: ${preview.overages.join('; ')}.` : ' No seat, storage, or API overages.'}
                  {preview.blockedModules?.length ? ` Modules to disable: ${preview.blockedModules.join(', ')}.` : ''}
                </small>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="sales-action-btn primary"
                  disabled={saving || requests.some((request) => ['REQUESTED', 'APPROVED'].includes(request.status)) || (preview.targetPlanCode === preview.currentPlanCode && preview.targetVersion === preview.currentVersion)}
                  onClick={() => void requestPlan()}
                >
                  {requests.some((request) => ['REQUESTED', 'APPROVED'].includes(request.status)) ? 'Request pending or scheduled' : 'Request plan change'}
                </button>
              )}
            </div>
          )}
          {requests.map((request) => (
            <div className="team-invite-link" key={request.id}>
              <div>
                <b>{request.targetPlanCode.replaceAll('_', ' ')} · {formatAuditLabel(request.status)}</b>
                <small>
                  {request.currentPlanCode.replaceAll('_', ' ')} → {request.targetPlanCode.replaceAll('_', ' ')} · effective {request.effectiveDate} · submitted {new Date(request.requestedAt).toLocaleDateString()}
                  {request.status === 'REQUESTED' ? ' · Awaiting commercial review' : request.status === 'APPROVED' ? ` · Approved, applies ${request.effectiveDate}` : request.status === 'APPLIED' ? ` · Applied ${request.appliedAt ? new Date(request.appliedAt).toLocaleDateString() : ''}` : request.status === 'REJECTED' ? ` · ${request.reviewNote || 'Rejected'}` : ''}
                </small>
              </div>
              {request.status === 'REQUESTED' && canEdit && (
                <button type="button" className="sales-action-btn secondary" disabled={saving} onClick={() => void cancelPlanRequest(request.id)}>
                  Cancel request
                </button>
              )}
            </div>
          ))}
          {!canEdit && <p className="form-note">Only workspace owners and admins can preview plan changes.</p>}
        </>
      )}
    </section>
  );
}

export function PlatformPlanReviewPanel({ notify }: Omit<PlanSettingsPanelsProps, 'role'>) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<PlatformPlanRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/platform/plan-requests`);
    if (response.status === 403) { setAllowed(false); return; }
    if (!response.ok) throw new Error('Could not load platform plan review queue');
    const data: PlatformPlanRequest[] = await response.json();
    setRequests(data);
    setAllowed(true);
  };
  useEffect(() => { void load().catch((error: unknown) => notify(messageFrom(error))); }, []);
  const review = async (id: string, action: 'approve' | 'reject'): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/platform/plan-requests/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: notes[id] || null }) });
      if (!response.ok) throw await responseError(response, `Could not ${action} request`);
      const body: { status: string } = await response.json();
      await load();
      notify(action === 'approve' ? (body.status === 'APPLIED' ? 'Plan approved and applied' : 'Plan approved and scheduled') : 'Plan request rejected');
    } catch (error) { notify(messageFrom(error)); }
    finally { setBusy(false); }
  };
  if (!allowed) return null;
  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">Platform plan review</h2>
          <p className="sales-card-subtitle">Commercial reviewers can approve upgrades, schedule downgrades, or reject requests with a reason. Decisions are audited in the affected workspace.</p>
        </div>
      </div>
      {requests.length ? (
        requests.map((request) => (
          <div className="team-invite-link" key={request.id}>
            <div>
              <b>{request.tenantName} · {request.currentPlanCode} → {request.targetPlanCode}</b>
              <small>
                {request.status} · effective {request.effectiveDate} · requested {new Date(request.requestedAt).toLocaleString()}
                {request.reviewNote ? ` · ${request.reviewNote}` : ''}
              </small>
              <input value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={500} placeholder="Review note (required for rejection)" />
            </div>
            {request.status === 'REQUESTED' && (
              <div className="import-actions" style={{ display: 'flex', gap: '6px' }}>
                <button className="sales-action-btn primary" disabled={busy} onClick={() => void review(request.id, 'approve')}>Approve</button>
                <button className="sales-action-btn secondary" disabled={busy || !notes[request.id]?.trim()} onClick={() => void review(request.id, 'reject')}>Reject</button>
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="empty-cell">No plan requests are awaiting review or scheduled.</p>
      )}
    </section>
  );
}
