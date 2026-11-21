import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  GitBranch,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  Sliders
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { formatCurrency } from '../../lib/utils/currency';

interface ApprovalWorkflowConfig {
  amountThreshold: number;
  requiredApprovals: number;
  approverRole: string;
}

interface ApprovalWorkflowVersion {
  id: string;
  version: number;
  status: string;
  configuration: ApprovalWorkflowConfig;
}

interface ApprovalWorkflow {
  key: string;
  name: string;
  published: ApprovalWorkflowVersion | null;
  draft: ApprovalWorkflowVersion | null;
  history: ApprovalWorkflowVersion[];
}

interface ApprovalPreview {
  amount: number;
  requiredApprovals: number;
  approverRole: string;
  thresholdTriggered: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isConfig(value: unknown): value is ApprovalWorkflowConfig {
  return (
    isRecord(value) &&
    typeof value.amountThreshold === 'number' &&
    typeof value.requiredApprovals === 'number' &&
    typeof value.approverRole === 'string'
  );
}
function isVersion(value: unknown): value is ApprovalWorkflowVersion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.version === 'number' &&
    typeof value.status === 'string' &&
    isConfig(value.configuration)
  );
}
function isWorkflow(value: unknown): value is ApprovalWorkflow {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    (value.published === null || isVersion(value.published)) &&
    (value.draft === null || isVersion(value.draft)) &&
    Array.isArray(value.history) &&
    value.history.every(isVersion)
  );
}
function isPreview(value: unknown): value is ApprovalPreview {
  return (
    isRecord(value) &&
    typeof value.amount === 'number' &&
    typeof value.requiredApprovals === 'number' &&
    typeof value.approverRole === 'string' &&
    typeof value.thresholdTriggered === 'boolean'
  );
}
function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function WorkflowStudio({ notify, role }: { notify: (message: string) => void; role?: string }) {
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [draftId, setDraftId] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [required, setRequired] = useState('2');
  const [approverRole, setApproverRole] = useState('MANAGER');
  const [previewAmount, setPreviewAmount] = useState('25000');
  const [preview, setPreview] = useState<ApprovalPreview | null>(null);
  const [working, setWorking] = useState(false);
  const canConfigure = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');
  const base = `${API}/workflows/purchase-order-approval`;

  const load = async (): Promise<void> => {
    const response = await apiFetch(base);
    if (!response.ok) throw new Error('Could not load approval workflow');
    const data: unknown = await response.json();
    if (!isWorkflow(data)) throw new Error('Invalid approval workflow response');
    setWorkflow(data);
    const currentConfig = data.draft?.configuration || data.published?.configuration;
    setDraftId(data.draft?.id || '');
    if (currentConfig) {
      setThreshold(String(currentConfig.amountThreshold));
      setRequired(String(currentConfig.requiredApprovals));
      setApproverRole(currentConfig.approverRole);
    }
  };

  useEffect(() => {
    void load().catch((error: unknown) => notify(messageFrom(error)));
  }, []);

  const request = async (path: string, method = 'POST', body?: unknown): Promise<unknown> => {
    const response = await apiFetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        isRecord(result) && typeof result.detail === 'string'
          ? result.detail
          : isRecord(result) && typeof result.message === 'string'
          ? result.message
          : 'Workflow update failed';
      throw new Error(detail);
    }
    return result;
  };

  const config = (): ApprovalWorkflowConfig => ({
    amountThreshold: Number(threshold),
    requiredApprovals: Number(required),
    approverRole
  });

  const saveDraft = async (): Promise<void> => {
    setWorking(true);
    try {
      if (draftId) await request(`/drafts/${draftId}`, 'PUT', config());
      else {
        const draft: unknown = await request('/drafts', 'POST', config());
        if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response');
        setDraftId(draft.id);
      }
      await load();
      notify('Approval workflow draft saved');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  const validate = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) {
        const draft: unknown = await request('/drafts', 'POST', config());
        if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response');
        id = draft.id;
        setDraftId(id);
      } else {
        await request(`/drafts/${id}`, 'PUT', config());
      }
      const result: unknown = await request(`/${id}/validate`);
      if (!isRecord(result) || typeof result.valid !== 'boolean') {
        throw new Error('Invalid approval workflow validation response');
      }
      await load();
      notify(result.valid ? 'Workflow validation passed: ready to publish' : 'Workflow needs adjustments');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  const previewPolicy = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) {
        const draft: unknown = await request('/drafts', 'POST', config());
        if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response');
        id = draft.id;
        setDraftId(id);
      } else {
        await request(`/drafts/${id}`, 'PUT', config());
      }
      const result: unknown = await request(`/${id}/preview`, 'POST', { amount: Number(previewAmount) });
      if (!isPreview(result)) throw new Error('Invalid approval workflow preview response');
      setPreview(result);
      await load();
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  const publish = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) {
        const draft: unknown = await request('/drafts', 'POST', config());
        if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response');
        id = draft.id;
        setDraftId(id);
      } else {
        await request(`/drafts/${id}`, 'PUT', config());
      }
      await request(`/${id}/validate`);
      await request(`/${id}/publish`);
      await load();
      notify('Purchase approval policy published successfully');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  const rollback = async (): Promise<void> => {
    setWorking(true);
    try {
      await request('/rollback');
      setPreview(null);
      await load();
      notify('Approval policy rolled back to previous version');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Policy Workbench (2-Column Grid) */}
      <div className="reports-grid-2col">
        {/* Left Column: Purchase Order Approval Policy Configuration */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitBranch size={15} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Purchase Order Approval Policy
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                  Define financial escalation thresholds, required approval quorum, and eligible signatory roles.
                </p>
              </div>
            </div>

            <span className={`audit-tag ${workflow?.published ? '' : 'danger'}`}>
              {workflow?.published ? `Published v${workflow.published.version}` : 'No Policy Published'}
            </span>
          </div>

          {canConfigure ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div className="audit-filter-field">
                  <label>Amount Threshold (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="10000"
                  />
                </div>

                <div className="audit-filter-field">
                  <label>Required Signatures</label>
                  <select value={required} onChange={(e) => setRequired(e.target.value)}>
                    <option value="1">1 Approver (Sign-off)</option>
                    <option value="2">2 Approvers (Dual control)</option>
                    <option value="3">3 Approvers (Consensus)</option>
                  </select>
                </div>

                <div className="audit-filter-field">
                  <label>Eligible Signatory Role</label>
                  <select value={approverRole} onChange={(e) => setApproverRole(e.target.value)}>
                    <option value="MANAGER">Manager or higher</option>
                    <option value="ADMIN">Administrator only</option>
                    <option value="OWNER">Workspace Owner</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--sp-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    disabled={working}
                    onClick={() => void saveDraft()}
                    style={{ height: '30px', fontSize: '12px' }}
                  >
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    disabled={working}
                    onClick={() => void validate()}
                    style={{ height: '30px', fontSize: '12px' }}
                  >
                    <span>Validate Rule</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="button button-primary"
                  disabled={working}
                  onClick={() => void publish()}
                  style={{ height: '30px', fontSize: '12px', padding: '0 16px' }}
                >
                  <CheckCircle2 size={13} />
                  <span>{working ? 'Publishing…' : 'Publish Policy'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
              Only workspace managers and administrators have jurisdiction to configure approval governance.
            </div>
          )}
        </div>

        {/* Right Column: Interactive Approval Path Simulator */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={14} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Approval Path Simulator
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                Simulate purchase orders to preview threshold enforcement.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div className="audit-filter-field" style={{ flex: 1 }}>
              <label>Purchase Order Amount (₹)</label>
              <input
                aria-label="Preview amount"
                type="number"
                min="0"
                step="0.01"
                value={previewAmount}
                onChange={(e) => setPreviewAmount(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={working}
              onClick={() => void previewPolicy()}
              style={{ height: '32px', fontSize: '12px' }}
            >
              <span>Simulate</span>
            </button>
          </div>

          {preview ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '6px',
                background: preview.thresholdTriggered ? 'var(--sp-brand-soft)' : 'var(--sp-surface-subtle)',
                border: '1px solid var(--sp-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={13} style={{ color: preview.thresholdTriggered ? 'var(--sp-brand)' : 'var(--sp-text-muted)' }} />
                <strong style={{ fontSize: '12px', color: 'var(--sp-text)' }}>
                  {formatCurrency(preview.amount)} Simulation Result
                </strong>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-secondary)', lineHeight: 1.4 }}>
                Requires <b>{preview.requiredApprovals} approval(s)</b> from <b>{formatAuditLabel(preview.approverRole)}</b>
                {preview.thresholdTriggered ? ' because amount meets or exceeds configured policy threshold.' : ' (standard floor procedure).'}
              </span>
            </div>
          ) : (
            <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '11.5px' }}>
              Enter a purchase amount and click Simulate to test approval rules.
            </div>
          )}

          {workflow?.published && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--sp-border-subtle)' }}>
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Active: v{workflow.published.version}
              </span>
              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={working || !workflow.history.some((item) => item.status === 'ROLLED_BACK')}
                onClick={() => void rollback()}
                style={{ height: '26px', fontSize: '11px' }}
                title="Rollback to earlier published version"
              >
                <RotateCcw size={11} />
                <span>Rollback Policy</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Version History Ledger */}
      <div className="reports-workbench-card" style={{ gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
            Policy Revision History
          </h4>
          <span className="audit-tag">{workflow?.history.length || 0} Versions</span>
        </div>

        <div className="reports-table-panel">
          <div className="table-scroll" style={{ margin: 0 }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>VERSION</th>
                  <th style={{ width: '20%' }}>STATUS</th>
                  <th style={{ width: '25%' }}>THRESHOLD</th>
                  <th style={{ width: '20%' }}>REQUIRED APPROVALS</th>
                  <th style={{ width: '20%' }}>SIGNATORY ROLE</th>
                </tr>
              </thead>
              <tbody>
                {!workflow?.history.length ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      No historical workflow versions recorded.
                    </td>
                  </tr>
                ) : (
                  workflow.history.map((version) => (
                    <tr key={version.id}>
                      <td>
                        <span className="sales-ref-badge">v{version.version}</span>
                      </td>
                      <td>
                        <span
                          className={`audit-tag ${
                            version.status === 'PUBLISHED'
                              ? ''
                              : version.status === 'ROLLED_BACK'
                              ? 'danger'
                              : ''
                          }`}
                        >
                          {formatAuditLabel(version.status)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(version.configuration.amountThreshold)}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {version.configuration.requiredApprovals} approver(s)
                      </td>
                      <td style={{ color: 'var(--sp-text-secondary)' }}>
                        {formatAuditLabel(version.configuration.approverRole)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
