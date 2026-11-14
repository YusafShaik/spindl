import { useEffect, useState } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

interface LeadTransition { from: string; to: string; requiredRole: string; }
interface LeadPipelineConfig { initialState: string; states: string[]; transitions: LeadTransition[]; }
interface LeadPipelineVersion { id: string; version: number; status: string; configuration: LeadPipelineConfig; }
interface LeadPipeline { key: string; name: string; published: LeadPipelineVersion | null; draft: LeadPipelineVersion | null; history: LeadPipelineVersion[]; }
interface LeadPipelinePreview { from: string; to: string; role: string; transitionExists: boolean; allowed: boolean; message: string; }
interface LeadPipelineValidation { valid: boolean; checks: string[]; stageCount: number; transitionCount: number; }

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isTransition(value: unknown): value is LeadTransition { return isRecord(value) && typeof value.from === 'string' && typeof value.to === 'string' && typeof value.requiredRole === 'string'; }
function isConfig(value: unknown): value is LeadPipelineConfig { return isRecord(value) && typeof value.initialState === 'string' && Array.isArray(value.states) && value.states.every((state) => typeof state === 'string') && Array.isArray(value.transitions) && value.transitions.every(isTransition); }
function isVersion(value: unknown): value is LeadPipelineVersion { return isRecord(value) && typeof value.id === 'string' && typeof value.version === 'number' && typeof value.status === 'string' && isConfig(value.configuration); }
function isWorkflow(value: unknown): value is LeadPipeline { return isRecord(value) && typeof value.key === 'string' && typeof value.name === 'string' && (value.published === null || isVersion(value.published)) && (value.draft === null || isVersion(value.draft)) && Array.isArray(value.history) && value.history.every(isVersion); }
function isPreview(value: unknown): value is LeadPipelinePreview { return isRecord(value) && typeof value.from === 'string' && typeof value.to === 'string' && typeof value.role === 'string' && typeof value.transitionExists === 'boolean' && typeof value.allowed === 'boolean' && typeof value.message === 'string'; }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function LeadPipelineStudio({ notify, role }: { notify: (message: string) => void; role?: string }) {
  const [workflow, setWorkflow] = useState<LeadPipeline | null>(null);
  const [draftId, setDraftId] = useState('');
  const [states, setStates] = useState(['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']);
  const [transitions, setTransitions] = useState<LeadTransition[]>([{ from: 'NEW', to: 'QUALIFIED', requiredRole: '' }, { from: 'NEW', to: 'LOST', requiredRole: '' }, { from: 'QUALIFIED', to: 'PROPOSAL', requiredRole: '' }, { from: 'QUALIFIED', to: 'LOST', requiredRole: '' }, { from: 'PROPOSAL', to: 'WON', requiredRole: '' }, { from: 'PROPOSAL', to: 'LOST', requiredRole: '' }]);
  const [previewFrom, setPreviewFrom] = useState('NEW');
  const [previewTo, setPreviewTo] = useState('QUALIFIED');
  const [preview, setPreview] = useState<LeadPipelinePreview | null>(null);
  const [working, setWorking] = useState(false);
  const canConfigure = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');
  const base = `${API}/workflows/lead-pipeline`;

  const config = (): LeadPipelineConfig => ({ initialState: 'NEW', states: states.map((value) => value.trim().toUpperCase()).filter(Boolean), transitions: transitions.map((row) => ({ ...row, from: row.from.toUpperCase(), to: row.to.toUpperCase() })) });
  const load = async (): Promise<void> => {
    const response = await apiFetch(base);
    if (!response.ok) throw new Error('Could not load the lead workflow');
    const data: unknown = await response.json();
    if (!isWorkflow(data)) throw new Error('Invalid lead workflow response');
    setWorkflow(data);
    setDraftId(data.draft?.id || '');
    const current = data.draft?.configuration || data.published?.configuration;
    if (current) { setStates(current.states); setTransitions(current.transitions); setPreviewFrom(current.initialState); setPreviewTo(current.transitions[0]?.to || current.initialState); }
  };
  useEffect(() => { void load().catch((error: unknown) => notify(messageFrom(error))); }, []);

  const request = async (path: string, method = 'POST', body?: unknown): Promise<unknown> => {
    const response = await apiFetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result: unknown = await response.json().catch(() => ({}));
    if (!response.ok) { const detail = isRecord(result) && typeof result.detail === 'string' ? result.detail : isRecord(result) && typeof result.message === 'string' ? result.message : 'Workflow request failed'; throw new Error(detail); }
    return result;
  };
  const save = async (): Promise<string> => {
    let id = draftId;
    if (id) await request(`/drafts/${id}`, 'PUT', config());
    else { const created: unknown = await request('/drafts', 'POST', config()); if (!isRecord(created) || typeof created.id !== 'string') throw new Error('Invalid lead workflow response'); id = created.id; setDraftId(id); }
    await load();
    return id;
  };
  const run = async (action: 'validate' | 'publish' | 'preview'): Promise<void> => {
    setWorking(true);
    try {
      const id = await save();
      if (action === 'validate') {
        const result: unknown = await request(`/${id}/validate`);
        if (!isRecord(result) || typeof result.valid !== 'boolean' || !Array.isArray(result.checks) || !result.checks.every((check) => typeof check === 'string')) throw new Error('Invalid lead workflow validation response');
        notify(result.valid ? 'Lead workflow checks passed' : result.checks.join(' '));
      } else if (action === 'publish') {
        await request(`/${id}/validate`);
        await request(`/${id}/publish`);
        await load();
        notify('Lead pipeline published');
      } else {
        const result: unknown = await request(`/${id}/preview`, 'POST', { from: previewFrom, to: previewTo, role });
        if (!isPreview(result)) throw new Error('Invalid lead workflow preview response');
        setPreview(result);
        await load();
      }
    } catch (error) { notify(messageFrom(error)); }
    finally { setWorking(false); }
  };
  const rollback = async (): Promise<void> => { setWorking(true); try { await request('/rollback'); await load(); notify('Lead workflow rolled back'); } catch (error) { notify(messageFrom(error)); } finally { setWorking(false); } };
  const updateStage = (index: number, value: string): void => {
    const previous = states[index];
    const nextValue = value.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 24);
    const next = states.map((stage, stateIndex) => stateIndex === index ? nextValue : stage);
    setStates(next);
    setTransitions((rows) => rows.map((row) => ({ ...row, from: row.from === previous ? nextValue : row.from, to: row.to === previous ? nextValue : row.to })));
  };

  return <section className="panel directory-panel saved-report-builder"><div className="panel-header directory-top"><div><h2>Lead pipeline workflow</h2><p>Configure lead stages and role-gated transitions. Published rules are enforced when a lead changes stage.</p></div><span className="record-count">{workflow?.published ? `Published v${workflow.published.version}` : 'No policy published'}</span></div>{canConfigure ? <><div className="report-builder-columns lead-workflow-stages">{states.map((stage, index) => <label key={`${index}-${stage}`}>{index < 3 ? 'Stage' : 'Outcome'}<input value={stage} maxLength={24} disabled={['NEW', 'WON', 'LOST'].includes(stage)} onChange={(event) => updateStage(index, event.target.value)}/></label>)}<button className="filter-button" disabled={states.length >= 12} onClick={() => setStates((current) => [...current, 'NEW_STAGE'])}>Add stage</button>{states.length > 5 && <button className="filter-button" onClick={() => { const remove = states.slice(3).at(-1); setStates((current) => current.filter((_, index) => index !== states.length - 1)); setTransitions((current) => current.filter((row) => row.from !== remove && row.to !== remove)); }}>Remove last stage</button>}</div>
    <div className="report-builder-saved"><b>Allowed transitions</b>{transitions.map((transition, index) => <article key={index} className="lead-workflow-transition"><label>From<select value={transition.from} onChange={(event) => setTransitions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, from: event.target.value } : row))}>{states.map((stage) => <option key={stage} value={stage}>{formatAuditLabel(stage)}</option>)}</select></label><span>to</span><label>To<select value={transition.to} onChange={(event) => setTransitions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, to: event.target.value } : row))}>{states.map((stage) => <option key={stage} value={stage}>{formatAuditLabel(stage)}</option>)}</select></label><label>Role<select value={transition.requiredRole || ''} onChange={(event) => setTransitions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, requiredRole: event.target.value } : row))}><option value="">Any permitted member</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select></label><button className="mini-action muted" onClick={() => setTransitions((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></article>)}<button className="filter-button" disabled={transitions.length >= 40 || states.length < 2} onClick={() => setTransitions((current) => [...current, { from: states[0], to: states[1], requiredRole: '' }])}>Add transition</button></div>
    <div className="transaction-filters"><button className="filter-button" disabled={working} onClick={() => void run('validate')}>Validate workflow</button><button className="button button-primary" disabled={working} onClick={() => void run('publish')}>Publish workflow</button><label>Preview from<select value={previewFrom} onChange={(event) => setPreviewFrom(event.target.value)}>{states.map((stage) => <option key={stage} value={stage}>{formatAuditLabel(stage)}</option>)}</select></label><label>Preview to<select value={previewTo} onChange={(event) => setPreviewTo(event.target.value)}>{states.map((stage) => <option key={stage} value={stage}>{formatAuditLabel(stage)}</option>)}</select></label><button className="filter-button" disabled={working} onClick={() => void run('preview')}>Preview transition</button>{workflow?.published && workflow.history.some((version) => version.status === 'ROLLED_BACK') && <button className="filter-button" disabled={working} onClick={() => void rollback()}>Rollback</button>}</div>{preview && <p className="form-note">{preview.message}</p>}</> : <p className="form-note">Only workspace managers and administrators can configure the lead pipeline.</p>}<div className="report-builder-saved"><b>Version history</b>{workflow?.history.length ? workflow.history.map((version) => <article key={version.id}><span><strong>Version {version.version} · {formatAuditLabel(version.status)}</strong><small>{version.configuration.states.map(formatAuditLabel).join(' → ')} · {version.configuration.transitions.length} transitions</small></span></article>) : <p className="empty-cell">No lead pipeline versions yet.</p>}</div></section>;
}
