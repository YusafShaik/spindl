import { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Clock } from 'lucide-react';
import { Status } from '../../components/ui/Status';
import { API, apiFetch } from '../../lib/api/client';

interface TenantSupportConsentPanelProps {
  role?: string;
  notify: (message: string) => void;
}

interface SupportConsentRequest {
  id: string;
  requesterEmail: string;
  status: string;
  reason: string;
  durationMinutes: number;
  createdAt: string;
  expiresAt: string | null;
  reviewNote: string | null;
}

export function TenantSupportConsentPanel({ role, notify }: TenantSupportConsentPanelProps) {
  const [rows, setRows] = useState<SupportConsentRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const canReview = role !== undefined && ['OWNER', 'ADMIN'].includes(role);

  const load = async (): Promise<void> => {
    const response = await apiFetch(`${API}/tenant/settings/support-requests`);
    if (!response.ok) throw new Error('Could not load support access requests');
    setRows(await response.json());
  };

  useEffect(() => {
    if (canReview) {
      load().catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
    }
  }, [canReview]);

  const decide = async (id: string, action: 'approve' | 'reject' | 'revoke'): Promise<void> => {
    let note = null;
    if (action === 'reject') {
      note = window.prompt('Why are you rejecting this support request?');
      if (!note?.trim()) return;
    } else if (action === 'revoke') {
      note = window.prompt('Optional reason for revoking support access') || null;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/tenant/settings/support-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not update support access');
      await load();
      notify(
        action === 'approve'
          ? 'Read-only support diagnostics approved for a limited time'
          : action === 'revoke'
          ? 'Support access revoked'
          : 'Support request rejected'
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!canReview) return null;

  return (
    <div className="reports-workbench-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Support Access Consent & Delegations
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
            Support engineers cannot impersonate users. Approving grants the operator read-only telemetry access for up to 60 minutes.
          </p>
        </div>
        <span className="sales-status-pill green">Zero Impersonation</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="reports-saved-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <b style={{ fontSize: '12.5px', color: 'var(--sp-text)' }}>{row.requesterEmail}</b>
                  <Status label={row.status} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                  {row.reason} · requested {row.durationMinutes} min · {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
                  {row.expiresAt ? ` · expires ${new Date(row.expiresAt).toLocaleString()}` : ''}
                  {row.reviewNote ? ` · ${row.reviewNote}` : ''}
                </div>
              </div>
              {row.status === 'REQUESTED' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="sales-action-btn primary"
                    disabled={busy}
                    onClick={() => decide(row.id, 'approve')}
                    style={{ height: '26px', fontSize: '11px' }}
                  >
                    Approve
                  </button>
                  <button
                    className="sales-action-btn secondary danger"
                    disabled={busy}
                    onClick={() => decide(row.id, 'reject')}
                    style={{ height: '26px', fontSize: '11px' }}
                  >
                    Reject
                  </button>
                </div>
              )}
              {row.status === 'APPROVED' && row.expiresAt && new Date(row.expiresAt) > new Date() && (
                <button
                  className="sales-action-btn secondary danger"
                  disabled={busy}
                  onClick={() => decide(row.id, 'revoke')}
                  style={{ height: '26px', fontSize: '11px' }}
                >
                  Revoke Access
                </button>
              )}
            </div>
          ))
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '12px 0', textAlign: 'center' }}>
            No active support access requests recorded for this workspace.
          </p>
        )}
      </div>
    </div>
  );
}
