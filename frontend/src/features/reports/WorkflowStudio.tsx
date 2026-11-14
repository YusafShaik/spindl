import { useEffect, useState } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';
import { formatCurrency } from '../../lib/utils/currency';

interface ApprovalWorkflowConfig { amountThreshold: number; requiredApprovals: number; approverRole: string; }
interface ApprovalWorkflowVersion { id: string; version: number; status: string; configuration: ApprovalWorkflowConfig; }
interface ApprovalWorkflow { key: string; name: string; published: ApprovalWorkflowVersion | null; draft: ApprovalWorkflowVersion | null; history: ApprovalWorkflowVersion[]; }
interface ApprovalPreview { amount: number; requiredApprovals: number; approverRole: string; thresholdTriggered: boolean; }

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isConfig(value: unknown): value is ApprovalWorkflowConfig { return isRecord(value) && typeof value.amountThreshold === 'number' && typeof value.requiredApprovals === 'number' && typeof value.approverRole === 'string'; }
function isVersion(value: unknown): value is ApprovalWorkflowVersion { return isRecord(value) && typeof value.id === 'string' && typeof value.version === 'number' && typeof value.status === 'string' && isConfig(value.configuration); }
function isWorkflow(value: unknown): value is ApprovalWorkflow { return isRecord(value) && typeof value.key === 'string' && typeof value.name === 'string' && (value.published === null || isVersion(value.published)) && (value.draft === null || isVersion(value.draft)) && Array.isArray(value.history) && value.history.every(isVersion); }
function isPreview(value: unknown): value is ApprovalPreview { return isRecord(value) && typeof value.amount === 'number' && typeof value.requiredApprovals === 'number' && typeof value.approverRole === 'string' && typeof value.thresholdTriggered === 'boolean'; }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

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
  useEffect(() => { void load().catch((error: unknown) => notify(messageFrom(error))); }, []);

  const request = async (path: string, method = 'POST', body?: unknown): Promise<unknown> => {
    const response = await apiFetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = isRecord(result) && typeof result.detail === 'string' ? result.detail : isRecord(result) && typeof result.message === 'string' ? result.message : 'Workflow update failed';
      throw new Error(detail);
    }
    return result;
  };
  const config = (): ApprovalWorkflowConfig => ({ amountThreshold: Number(threshold), requiredApprovals: Number(required), approverRole });
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
    } catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };
  const validate = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) { const draft: unknown = await request('/drafts', 'POST', config()); if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response'); id = draft.id; setDraftId(id); }
      else await request(`/drafts/${id}`, 'PUT', config());
      const result: unknown = await request(`/${id}/validate`);
      if (!isRecord(result) || typeof result.valid !== 'boolean') throw new Error('Invalid approval workflow validation response');
      await load();
      notify(result.valid ? 'Workflow checks passed' : 'Workflow needs changes');
    } catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };
  const previewPolicy = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) { const draft: unknown = await request('/drafts', 'POST', config()); if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response'); id = draft.id; setDraftId(id); }
      else await request(`/drafts/${id}`, 'PUT', config());
      const result: unknown = await request(`/${id}/preview`, 'POST', { amount: Number(previewAmount) });
      if (!isPreview(result)) throw new Error('Invalid approval workflow preview response');
      setPreview(result);
      await load();
    } catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };
  const publish = async (): Promise<void> => {
    setWorking(true);
    try {
      let id = draftId;
      if (!id) { const draft: unknown = await request('/drafts', 'POST', config()); if (!isRecord(draft) || typeof draft.id !== 'string') throw new Error('Invalid approval workflow response'); id = draft.id; setDraftId(id); }
      else await request(`/drafts/${id}`, 'PUT', config());
      await request(`/${id}/validate`);
      await request(`/${id}/publish`);
      await load();
      notify('Purchase approval policy published');
    } catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };
  const rollback = async (): Promise<void> => {
    setWorking(true);
    try { await request('/rollback'); setPreview(null); await load(); notify('Approval policy rolled back'); }
    catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };

  return <section className="panel directory-panel saved-report-builder"><div className="panel-header directory-top"><div><h2>Purchase approval workflow</h2><p>Set an amount threshold, approval count, and eligible workspace role. Changes take effect after publishing.</p></div><span className="record-count">{workflow?.published ? `Published v${workflow.published.version}` : 'No policy published'}</span></div>{canConfigure ? <><div className="transaction-filters"><label>Threshold amount<input type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)}/></label><label>Required approvals<select value={required} onChange={(event) => setRequired(event.target.value)}><option value="1">1 approver</option><option value="2">2 approvers</option><option value="3">3 approvers</option></select></label><label>Eligible approver role<select value={approverRole} onChange={(event) => setApproverRole(event.target.value)}><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select></label><button className="filter-button" disabled={working} onClick={() => void saveDraft()}>Save draft</button><button className="filter-button" disabled={working} onClick={() => void validate()}>Validate</button><button className="button button-primary" disabled={working} onClick={() => void publish()}>Publish</button></div><div className="report-builder-result-heading"><div><b>Try a purchase amount</b><small>High value orders use the configured approval count.</small></div><div className="report-builder-search"><input aria-label="Preview amount" type="number" min="0" step="0.01" value={previewAmount} onChange={(event) => setPreviewAmount(event.target.value)}/><button className="mini-action" disabled={working} onClick={() => void previewPolicy()}>Preview</button>{workflow?.published && <button className="mini-action muted" disabled={working || !workflow.history.some((item) => item.status === 'ROLLED_BACK')} onClick={() => void rollback()}>Rollback</button>}</div></div>{preview && <p className="form-note">{formatCurrency(preview.amount)} needs {preview.requiredApprovals} approval(s) from {formatAuditLabel(preview.approverRole)}{preview.thresholdTriggered ? ' because it meets the threshold.' : '.'}</p>}</> : <p className="form-note">Only workspace managers and administrators can configure this workflow.</p>}<div className="report-builder-saved"><b>Version history</b>{workflow?.history.length ? workflow.history.map((version) => <article key={version.id}><span><strong>Version {version.version} · {formatAuditLabel(version.status)}</strong><small>Threshold {formatCurrency(version.configuration.amountThreshold)} · {version.configuration.requiredApprovals} approver(s) · {formatAuditLabel(version.configuration.approverRole)}</small></span></article>) : <p className="empty-cell">No workflow versions yet.</p>}</div></section>;
}
