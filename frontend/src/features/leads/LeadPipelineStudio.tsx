import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  History,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

interface LeadTransition {
  from: string;
  to: string;
  requiredRole: string;
}

interface LeadPipelineConfig {
  initialState: string;
  states: string[];
  transitions: LeadTransition[];
}

interface LeadPipelineVersion {
  id: string;
  version: number;
  status: string;
  configuration: LeadPipelineConfig;
}

interface LeadPipeline {
  key: string;
  name: string;
  published: LeadPipelineVersion | null;
  draft: LeadPipelineVersion | null;
  history: LeadPipelineVersion[];
}

interface LeadPipelinePreview {
  from: string;
  to: string;
  role: string;
  transitionExists: boolean;
  allowed: boolean;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTransition(value: unknown): value is LeadTransition {
  return (
    isRecord(value) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    typeof value.requiredRole === 'string'
  );
}

function isConfig(value: unknown): value is LeadPipelineConfig {
  return (
    isRecord(value) &&
    typeof value.initialState === 'string' &&
    Array.isArray(value.states) &&
    value.states.every((state) => typeof state === 'string') &&
    Array.isArray(value.transitions) &&
    value.transitions.every(isTransition)
  );
}

function isVersion(value: unknown): value is LeadPipelineVersion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.version === 'number' &&
    typeof value.status === 'string' &&
    isConfig(value.configuration)
  );
}

function isWorkflow(value: unknown): value is LeadPipeline {
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

function isPreview(value: unknown): value is LeadPipelinePreview {
  return (
    isRecord(value) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    typeof value.role === 'string' &&
    typeof value.transitionExists === 'boolean' &&
    typeof value.allowed === 'boolean' &&
    typeof value.message === 'string'
  );
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LeadPipelineStudio({
  notify,
  role
}: {
  notify: (message: string) => void;
  role?: string;
}) {
  const [workflow, setWorkflow] = useState<LeadPipeline | null>(null);
  const [draftId, setDraftId] = useState('');
  const [states, setStates] = useState(['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']);
  const [transitions, setTransitions] = useState<LeadTransition[]>([
    { from: 'NEW', to: 'QUALIFIED', requiredRole: '' },
    { from: 'NEW', to: 'LOST', requiredRole: '' },
    { from: 'QUALIFIED', to: 'PROPOSAL', requiredRole: '' },
    { from: 'QUALIFIED', to: 'LOST', requiredRole: '' },
    { from: 'PROPOSAL', to: 'WON', requiredRole: '' },
    { from: 'PROPOSAL', to: 'LOST', requiredRole: '' }
  ]);
  const [previewFrom, setPreviewFrom] = useState('NEW');
  const [previewTo, setPreviewTo] = useState('QUALIFIED');
  const [preview, setPreview] = useState<LeadPipelinePreview | null>(null);
  const [working, setWorking] = useState(false);

  const canConfigure = ['OWNER', 'ADMIN', 'MANAGER'].includes(role ?? '');
  const base = `${API}/workflows/lead-pipeline`;

  const config = (): LeadPipelineConfig => ({
    initialState: 'NEW',
    states: states.map((value) => value.trim().toUpperCase()).filter(Boolean),
    transitions: transitions.map((row) => ({
      ...row,
      from: row.from.toUpperCase(),
      to: row.to.toUpperCase()
    }))
  });

  const load = async (): Promise<void> => {
    const response = await apiFetch(base);
    if (!response.ok) throw new Error('Could not load the lead workflow');
    const data: unknown = await response.json();
    if (!isWorkflow(data)) throw new Error('Invalid lead workflow response');
    setWorkflow(data);
    setDraftId(data.draft?.id || '');
    const current = data.draft?.configuration || data.published?.configuration;
    if (current) {
      setStates(current.states);
      setTransitions(current.transitions);
      setPreviewFrom(current.initialState);
      setPreviewTo(current.transitions[0]?.to || current.initialState);
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
          : 'Workflow request failed';
      throw new Error(detail);
    }
    return result;
  };

  const save = async (): Promise<string> => {
    let id = draftId;
    if (id) {
      await request(`/drafts/${id}`, 'PUT', config());
    } else {
      const created: unknown = await request('/drafts', 'POST', config());
      if (!isRecord(created) || typeof created.id !== 'string') {
        throw new Error('Invalid lead workflow response');
      }
      id = created.id;
      setDraftId(id);
    }
    await load();
    return id;
  };

  const run = async (action: 'validate' | 'publish' | 'preview'): Promise<void> => {
    setWorking(true);
    try {
      const id = await save();
      if (action === 'validate') {
        const result: unknown = await request(`/${id}/validate`);
        if (
          !isRecord(result) ||
          typeof result.valid !== 'boolean' ||
          !Array.isArray(result.checks) ||
          !result.checks.every((check) => typeof check === 'string')
        ) {
          throw new Error('Invalid lead workflow validation response');
        }
        notify(result.valid ? 'Lead workflow checks passed' : result.checks.join(' '));
      } else if (action === 'publish') {
        await request(`/${id}/validate`);
        await request(`/${id}/publish`);
        await load();
        notify('Lead pipeline published successfully');
      } else {
        const result: unknown = await request(`/${id}/preview`, 'POST', {
          from: previewFrom,
          to: previewTo,
          role
        });
        if (!isPreview(result)) throw new Error('Invalid lead workflow preview response');
        setPreview(result);
        await load();
      }
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
      await load();
      notify('Lead workflow rolled back');
    } catch (error) {
      notify(messageFrom(error));
    } finally {
      setWorking(false);
    }
  };

  const updateStage = (index: number, value: string): void => {
    const previous = states[index];
    const nextValue = value
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .slice(0, 24);
    const next = states.map((stage, stateIndex) => (stateIndex === index ? nextValue : stage));
    setStates(next);
    setTransitions((rows) =>
      rows.map((row) => ({
        ...row,
        from: row.from === previous ? nextValue : row.from,
        to: row.to === previous ? nextValue : row.to
      }))
    );
  };

  if (!canConfigure) {
    return (
      <div className="reports-workbench-card" style={{ textAlign: 'center', padding: '36px' }}>
        <p style={{ color: 'var(--sp-text-muted)', fontSize: '13px' }}>
          Only workspace managers and administrators can configure the lead pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="reports-grid-2col">
      {/* Column 1: Pipeline Stages & Governance Matrix */}
      <div className="reports-workbench-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)', margin: 0 }}>
              Lead Pipeline Governance Studio
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '4px 0 0 0' }}>
              Define deal lifecycle stages and role-enforced gate policies across sales conversions.
            </p>
          </div>
          <span className="sales-status-pill blue" style={{ whiteSpace: 'nowrap' }}>
            {workflow?.published ? `Published v${workflow.published.version}` : 'No policy published'}
          </span>
        </div>

        {/* 1. Pipeline Stages Array */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="sales-input-label" style={{ margin: 0 }}>
              PIPELINE LIFECYCLE STAGES ({states.length}/12)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="sales-action-btn secondary"
                disabled={states.length >= 12}
                onClick={() => setStates((curr) => [...curr, 'NEW_STAGE'])}
                style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
              >
                <Plus size={11} />
                <span>Add Stage</span>
              </button>
              {states.length > 5 && (
                <button
                  type="button"
                  className="sales-action-btn secondary danger"
                  onClick={() => {
                    const remove = states.slice(3).at(-1);
                    setStates((curr) => curr.filter((_, idx) => idx !== states.length - 1));
                    setTransitions((curr) =>
                      curr.filter((row) => row.from !== remove && row.to !== remove)
                    );
                  }}
                  style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                >
                  <Trash2 size={11} />
                  <span>Remove Last</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {states.map((stage, index) => {
              const isLocked = ['NEW', 'WON', 'LOST'].includes(stage);
              return (
                <div
                  key={`${index}-${stage}`}
                  style={{
                    background: 'var(--sp-surface-subtle)',
                    border: '1px solid var(--sp-border)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: 'var(--sp-text-muted)', fontWeight: 600 }}>
                      {index === 0 ? 'START' : stage === 'WON' || stage === 'LOST' ? 'TERMINAL' : `STAGE ${index}`}
                    </span>
                    {isLocked && <Lock size={10} style={{ color: 'var(--sp-text-muted)' }} />}
                  </div>
                  <input
                    value={stage}
                    maxLength={24}
                    disabled={isLocked}
                    className="sales-text-input"
                    style={{
                      height: '26px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      background: isLocked ? 'transparent' : 'var(--sp-surface)',
                      border: isLocked ? 'none' : '1px solid var(--sp-border)'
                    }}
                    onChange={(e) => updateStage(index, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Allowed Transitions Governance Matrix */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="sales-input-label" style={{ margin: 0 }}>
              ALLOWED TRANSITIONS & AUTHORIZATION RULES ({transitions.length}/40)
            </label>
            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={transitions.length >= 40 || states.length < 2}
              onClick={() =>
                setTransitions((curr) => [...curr, { from: states[0], to: states[1], requiredRole: '' }])
              }
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              <Plus size={11} />
              <span>Add Transition</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
            {transitions.map((transition, index) => (
              <div key={index} className="lead-transition-grid">
                <select
                  className="sales-select-input"
                  style={{ height: '28px', fontSize: '11.5px' }}
                  value={transition.from}
                  onChange={(e) =>
                    setTransitions((curr) =>
                      curr.map((r, i) => (i === index ? { ...r, from: e.target.value } : r))
                    )
                  }
                >
                  {states.map((stage) => (
                    <option key={stage} value={stage}>
                      {formatAuditLabel(stage)}
                    </option>
                  ))}
                </select>

                <ArrowRight size={13} style={{ color: 'var(--sp-text-muted)' }} />

                <select
                  className="sales-select-input"
                  style={{ height: '28px', fontSize: '11.5px' }}
                  value={transition.to}
                  onChange={(e) =>
                    setTransitions((curr) =>
                      curr.map((r, i) => (i === index ? { ...r, to: e.target.value } : r))
                    )
                  }
                >
                  {states.map((stage) => (
                    <option key={stage} value={stage}>
                      {formatAuditLabel(stage)}
                    </option>
                  ))}
                </select>

                <select
                  className="sales-select-input"
                  style={{ height: '28px', fontSize: '11.5px' }}
                  value={transition.requiredRole || ''}
                  onChange={(e) =>
                    setTransitions((curr) =>
                      curr.map((r, i) => (i === index ? { ...r, requiredRole: e.target.value } : r))
                    )
                  }
                >
                  <option value="">Any member</option>
                  <option value="MANAGER">Manager only</option>
                  <option value="ADMIN">Admin only</option>
                  <option value="OWNER">Owner only</option>
                </select>

                <button
                  type="button"
                  className="sales-action-btn secondary danger"
                  onClick={() => setTransitions((curr) => curr.filter((_, i) => i !== index))}
                  style={{ height: '28px', width: '28px', padding: 0, justifyContent: 'center' }}
                  title="Remove transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--sp-border)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="sales-action-btn primary"
              disabled={working}
              onClick={() => void run('publish')}
            >
              <Send size={12} />
              <span>Publish Workflow</span>
            </button>

            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={working}
              onClick={() => void run('validate')}
            >
              <ShieldCheck size={12} />
              <span>Validate Rules</span>
            </button>

            <button
              type="button"
              className="sales-action-btn secondary"
              disabled={working}
              onClick={() => void save()}
            >
              <Save size={12} />
              <span>Save Draft</span>
            </button>
          </div>

          {workflow?.published && workflow.history.some((v) => v.status === 'ROLLED_BACK') && (
            <button
              type="button"
              className="sales-action-btn secondary danger"
              disabled={working}
              onClick={() => void rollback()}
            >
              <RotateCcw size={12} />
              <span>Rollback</span>
            </button>
          )}
        </div>
      </div>

      {/* Column 2: Transition Simulator & Version History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Simulator Workbench */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={13} style={{ color: 'var(--sp-brand)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                TRANSITION PATH SIMULATOR
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              Active role: {role || 'USER'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
            <div>
              <label className="sales-input-label">TEST FROM</label>
              <select
                className="sales-select-input"
                value={previewFrom}
                onChange={(e) => setPreviewFrom(e.target.value)}
              >
                {states.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatAuditLabel(stage)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ paddingTop: '16px' }}>
              <ArrowRight size={14} style={{ color: 'var(--sp-text-muted)' }} />
            </div>

            <div>
              <label className="sales-input-label">TEST TO</label>
              <select
                className="sales-select-input"
                value={previewTo}
                onChange={(e) => setPreviewTo(e.target.value)}
              >
                {states.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatAuditLabel(stage)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="sales-action-btn secondary"
            disabled={working}
            onClick={() => void run('preview')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Play size={12} />
            <span>Simulate Transition Permitted</span>
          </button>

          {preview && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${preview.allowed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                background: preview.allowed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}
            >
              {preview.allowed ? (
                <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <XCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: preview.allowed ? '#10b981' : '#ef4444'
                  }}
                >
                  {preview.allowed ? 'Transition Permitted' : 'Transition Restricted'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--sp-text)' }}>
                  {preview.message}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Version Directory */}
        <div className="reports-workbench-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sp-border)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={13} style={{ color: 'var(--sp-text-muted)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                REVISION HISTORY
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
              {workflow?.history.length || 0} versions
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {workflow?.history.length ? (
              workflow.history.map((version) => (
                <div key={version.id} className="reports-saved-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                        Version {version.version}
                      </span>
                      <span className={`sales-status-pill ${version.status === 'PUBLISHED' ? 'green' : version.status === 'ROLLED_BACK' ? 'red' : 'gray'}`}>
                        {formatAuditLabel(version.status)}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      {version.configuration.states.map(formatAuditLabel).join(' → ')}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)' }}>
                      {version.configuration.transitions.length} gate transitions
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--sp-text-muted)', margin: '10px 0', textAlign: 'center' }}>
                No workflow versions recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
