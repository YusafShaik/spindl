import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Key,
  Lock,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Webhook,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

interface TenantApiTokensPanelProps {
  role?: string;
  notify: (message: string) => void;
}

interface TenantWebhooksPanelProps {
  role?: string;
  notify: (message: string) => void;
}

interface ApiTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  active: boolean;
  createdAt: string;
  deadLetterCount: number;
}

interface WebhookDelivery {
  id: string;
  endpointName: string;
  eventType: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export function TenantApiTokensPanel({ role, notify }: TenantApiTokensPanelProps) {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('90');
  const [createdSecret, setCreatedSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const canManage = role !== undefined && ['OWNER', 'ADMIN'].includes(role);
  const path = API + '/tenant/settings/api-tokens';

  const load = async (): Promise<void> => {
    const [tokenResponse, scopeResponse] = await Promise.all([
      apiFetch(path),
      apiFetch(path + '/scopes')
    ]);
    if (!tokenResponse.ok || !scopeResponse.ok) throw new Error('Could not load API tokens');
    const [tokenRows, scopeRows]: [ApiTokenSummary[], string[]] = await Promise.all([
      tokenResponse.json(),
      scopeResponse.json()
    ]);
    setTokens(tokenRows);
    setScopes(scopeRows);
  };

  useEffect(() => {
    load().catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scopes: selected,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not create API token');
      setCreatedSecret(body.secret);
      setName('');
      setSelected([]);
      await load();
      notify('API token created. Copy its secret now.');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (token: ApiTokenSummary): Promise<void> => {
    if (!window.confirm(`Revoke API token "${token.name}"? Active integrations using this token will stop working immediately.`)) {
      return;
    }
    try {
      const response = await apiFetch(path + '/' + token.id, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not revoke API token');
      await load();
      notify('API token revoked');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      notify('API token secret copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy the token manually from the field');
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === scopes.length) {
      setSelected([]);
    } else {
      setSelected([...scopes]);
    }
  };

  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">API tokens</h2>
          <p className="sales-card-subtitle">
            Create scoped Bearer credentials for trusted scripts and automated integrations. The secret token is shown once and cannot be recovered.
          </p>
        </div>
      </div>

      {canManage ? (
        <form className="integration-form-card" onSubmit={create}>
          {/* Top Row: Token Name, Expiry, Submit */}
          <div className="integration-form-row">
            <label style={{ flex: 2 }}>
              Token name *
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Inventory Sync Service"
              />
            </label>
            <label style={{ flex: 1, minWidth: '140px' }}>
              Expiration period
              <select value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}>
                <option value="30">30 days</option>
                <option value="90">90 days (Recommended)</option>
                <option value="180">180 days</option>
                <option value="365">365 days</option>
                <option value="">No expiry</option>
              </select>
            </label>
            <button
              className="button button-primary"
              disabled={saving || !name.trim() || !selected.length}
              style={{ height: '32px' }}
            >
              {saving ? 'Creating…' : 'Create API token'}
            </button>
          </div>

          {/* Scopes Section */}
          <div className="integration-scopes-container">
            <div className="integration-scopes-header">
              <div className="integration-scopes-title">
                <Shield size={13} color="var(--sp-brand, #8b5cf6)" />
                <span>Access permissions & scopes</span>
                <span className="integration-scopes-count">
                  ({selected.length} of {scopes.length} selected)
                </span>
              </div>
              <button
                type="button"
                className="integration-scopes-toggle-btn"
                onClick={toggleSelectAll}
              >
                {selected.length === scopes.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="integration-scopes-grid">
              {scopes.map((scope) => {
                const isChecked = selected.includes(scope);
                return (
                  <label
                    key={scope}
                    className={`integration-scope-chip ${isChecked ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        setSelected((cur) =>
                          cur.includes(scope)
                            ? cur.filter((s) => s !== scope)
                            : [...cur, scope]
                        )
                      }
                    />
                    <span title={scope}>{formatAuditLabel(scope.replaceAll(':', ' '))}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      ) : (
        <p className="form-note">Only workspace owners and admins can issue or revoke API tokens.</p>
      )}

      {/* Secret Reveal Banner */}
      {createdSecret && (
        <div className="integration-secret-banner">
          <div className="integration-secret-header">
            <Lock size={15} color="var(--sp-brand, #8b5cf6)" />
            <div>
              <b>Copy your API token secret now</b>
              <small style={{ display: 'block' }}>
                This is the only time this secret will be revealed. Store it securely in your secrets manager.
              </small>
            </div>
          </div>
          <div className="integration-secret-row">
            <input readOnly value={createdSecret} />
            <button
              type="button"
              className="button button-primary"
              onClick={copySecret}
              style={{ height: '32px', whiteSpace: 'nowrap' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy token'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setCreatedSecret('')}
              style={{ height: '32px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Saved Tokens Table */}
      <div style={{ marginTop: '12px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
          Active workspace tokens
        </h3>

        {tokens.length === 0 ? (
          <div
            className="panel production-empty"
            style={{ padding: '28px', textAlign: 'center', border: '1px dashed var(--sp-border)' }}
          >
            <Key size={20} style={{ color: 'var(--sp-text-subtle)', marginBottom: '6px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-muted)' }}>
              No API tokens created yet. Issue a token above to connect external services.
            </p>
          </div>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>TOKEN NAME</th>
                  <th style={{ width: '14%' }}>PREFIX</th>
                  <th style={{ width: '26%' }}>SCOPES</th>
                  <th style={{ width: '14%' }}>EXPIRES</th>
                  <th style={{ width: '14%' }}>LAST USED</th>
                  <th style={{ width: '6%' }}>STATUS</th>
                  {canManage && <th style={{ width: '6%', textAlign: 'right' }}>ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <b style={{ color: 'var(--sp-text)' }}>{token.name}</b>
                    </td>
                    <td>
                      <code className="settings-code-chip">{token.tokenPrefix}…</code>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--sp-text-muted)',
                          maxWidth: '220px',
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={token.scopes.map((s) => formatAuditLabel(s.replaceAll(':', ' '))).join(', ')}
                      >
                        {token.scopes.length} scope(s) ({token.scopes.slice(0, 2).map((s) => s.split(':')[0]).join(', ')}…)
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '11.5px' }}>
                      {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '11.5px' }}>
                      {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <span
                        className={`module-state ${
                          token.revokedAt ? '' : 'enabled'
                        }`}
                      >
                        {token.revokedAt ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {!token.revokedAt && (
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', fontSize: '11px', padding: '0 8px', color: 'var(--sp-danger)' }}
                            onClick={() => revoke(token)}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function TenantWebhooksPanel({ role, notify }: TenantWebhooksPanelProps) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const canManage = role !== undefined && ['OWNER', 'ADMIN'].includes(role);
  const path = API + '/tenant/settings/webhooks';

  const load = async (): Promise<void> => {
    const responses = await Promise.all([
      apiFetch(path),
      apiFetch(path + '/events'),
      apiFetch(path + '/deliveries')
    ]);
    if (responses.some((r) => !r.ok)) throw new Error('Could not load webhook settings');
    const endpointRows: WebhookEndpoint[] = await responses[0].json();
    const eventRows: string[] = await responses[1].json();
    const deliveryRows: WebhookDelivery[] = await responses[2].json();
    setEndpoints(endpointRows);
    setEvents(eventRows);
    setDeliveries(deliveryRows);
  };

  useEffect(() => {
    load().catch((error: unknown) => notify(error instanceof Error ? error.message : String(error)));
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetUrl, eventTypes: selected })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not create webhook');
      setSecret(body.signingSecret);
      setName('');
      setTargetUrl('');
      setSelected([]);
      await load();
      notify('Webhook endpoint created. Copy its signing secret now.');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (endpoint: WebhookEndpoint): Promise<void> => {
    try {
      const response = await apiFetch(path + '/' + endpoint.id, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disable webhook');
      await load();
      notify('Webhook disabled');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const replay = async (delivery: WebhookDelivery): Promise<void> => {
    try {
      const response = await apiFetch(path + '/deliveries/' + delivery.id + '/replay', {
        method: 'POST'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || body.message || 'Could not replay webhook');
      await load();
      notify('Delivery queued for immediate replay');
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      notify('Signing secret copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy the signing secret manually');
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === events.length) {
      setSelected([]);
    } else {
      setSelected([...events]);
    }
  };

  return (
    <section className="sales-table-card tenant-settings-panel">
      <div className="sales-card-header">
        <div>
          <h2 className="sales-card-title">Signed webhooks</h2>
          <p className="sales-card-subtitle">
            Stream transaction and approval events to external HTTPS endpoints. Outbound HTTP requests carry an HMAC-SHA256 signature and retry automatically with dead-letter protection.
          </p>
        </div>
      </div>

      {canManage ? (
        <form className="integration-form-card" onSubmit={create}>
          {/* Top Row: Name, URL, Add */}
          <div className="integration-form-row">
            <label style={{ flex: 1 }}>
              Endpoint name *
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ERP Gateway / Accounting Sync"
              />
            </label>
            <label style={{ flex: 2, minWidth: '220px' }}>
              HTTPS destination URL *
              <input
                required
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/spindl"
              />
            </label>
            <button
              className="sales-action-btn primary"
              disabled={saving || !name.trim() || !targetUrl.trim() || !selected.length}
              style={{ height: '32px' }}
            >
              <Plus size={13} />
              <span>{saving ? 'Saving…' : 'Add webhook'}</span>
            </button>
          </div>

          {/* Subscribed Events Grid */}
          <div className="integration-scopes-container">
            <div className="integration-scopes-header">
              <div className="integration-scopes-title">
                <Webhook size={13} color="var(--sp-brand, #8b5cf6)" />
                <span>Subscribed event triggers</span>
                <span className="integration-scopes-count">
                  ({selected.length} of {events.length} selected)
                </span>
              </div>
              <button
                type="button"
                className="integration-scopes-toggle-btn"
                onClick={toggleSelectAll}
              >
                {selected.length === events.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="integration-scopes-grid">
              {events.map((eventType) => {
                const isChecked = selected.includes(eventType);
                return (
                  <label
                    key={eventType}
                    className={`integration-scope-chip ${isChecked ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        setSelected((cur) =>
                          cur.includes(eventType)
                            ? cur.filter((e) => e !== eventType)
                            : [...cur, eventType]
                        )
                      }
                    />
                    <span title={eventType}>{formatAuditLabel(eventType)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      ) : (
        <p className="form-note">Only workspace owners and admins can configure webhook destinations.</p>
      )}

      {/* Secret Reveal Banner */}
      {secret && (
        <div className="integration-secret-banner">
          <div className="integration-secret-header">
            <Lock size={15} color="var(--sp-brand, #8b5cf6)" />
            <div>
              <b>Copy the HMAC signing secret now</b>
              <small style={{ display: 'block' }}>
                This signing secret is encrypted at rest and will only be displayed this once. Use it to verify incoming payload signatures.
              </small>
            </div>
          </div>
          <div className="integration-secret-row">
            <input readOnly value={secret} />
            <button
              type="button"
              className="button button-primary"
              onClick={copySecret}
              style={{ height: '32px', whiteSpace: 'nowrap' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy secret'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSecret('')}
              style={{ height: '32px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Endpoints Table */}
      <div style={{ marginTop: '12px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
          Configured destinations
        </h3>

        {endpoints.length === 0 ? (
          <div
            className="panel production-empty"
            style={{ padding: '28px', textAlign: 'center', border: '1px dashed var(--sp-border)' }}
          >
            <Webhook size={20} style={{ color: 'var(--sp-text-subtle)', marginBottom: '6px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-muted)' }}>
              No webhook endpoints registered. Add an endpoint above to receive event streams.
            </p>
          </div>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>NAME</th>
                  <th style={{ width: '28%' }}>DESTINATION URL</th>
                  <th style={{ width: '26%' }}>TRIGGER EVENTS</th>
                  <th style={{ width: '10%' }}>DEAD LETTERS</th>
                  <th style={{ width: '8%' }}>STATUS</th>
                  {canManage && <th style={{ width: '8%', textAlign: 'right' }}>ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td>
                      <b style={{ color: 'var(--sp-text)' }}>{endpoint.name}</b>
                    </td>
                    <td>
                      <code className="settings-code-chip">{endpoint.targetUrl}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                        {endpoint.eventTypes.map(formatAuditLabel).join(', ')}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span
                        style={{
                          color: endpoint.deadLetterCount > 0 ? 'var(--sp-error)' : 'var(--sp-text-muted)',
                          fontWeight: endpoint.deadLetterCount > 0 ? 600 : 400
                        }}
                      >
                        {endpoint.deadLetterCount}
                      </span>
                    </td>
                    <td>
                      <span className={`module-state ${endpoint.active ? 'enabled' : ''}`}>
                        {endpoint.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {endpoint.active && (
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                            onClick={() => deactivate(endpoint)}
                          >
                            Disable
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deliveries Table */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
          Recent delivery attempts & audit log
        </h3>

        {deliveries.length === 0 ? (
          <div
            className="panel production-empty"
            style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--sp-border)' }}
          >
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-muted)' }}>
              No webhook events have been queued recently.
            </p>
          </div>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>ENDPOINT</th>
                  <th style={{ width: '20%' }}>EVENT</th>
                  <th style={{ width: '10%' }}>ATTEMPTS</th>
                  <th style={{ width: '12%' }}>HTTP STATUS</th>
                  <th style={{ width: '16%' }}>QUEUED AT</th>
                  <th style={{ width: '12%' }}>STATUS</th>
                  {canManage && <th style={{ width: '10%', textAlign: 'right' }}>ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <b style={{ color: 'var(--sp-text)' }}>{delivery.endpointName}</b>
                    </td>
                    <td>
                      <span style={{ fontSize: '11.5px', color: 'var(--sp-text)' }}>
                        {formatAuditLabel(delivery.eventType)}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{delivery.attempts}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {delivery.responseStatus ? `HTTP ${delivery.responseStatus}` : '—'}
                      {delivery.lastError && (
                        <small style={{ display: 'block', color: 'var(--sp-error)', fontSize: '10px' }}>
                          {delivery.lastError}
                        </small>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      {delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : ''}
                    </td>
                    <td>
                      <span
                        className={`module-state ${
                          delivery.status === 'DELIVERED'
                            ? 'enabled'
                            : delivery.status === 'DEAD'
                            ? ''
                            : ''
                        }`}
                        style={{
                          color:
                            delivery.status === 'DELIVERED'
                              ? 'var(--sp-success)'
                              : delivery.status === 'DEAD'
                              ? 'var(--sp-error)'
                              : 'var(--sp-warning)'
                        }}
                      >
                        {formatAuditLabel(delivery.status)}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {delivery.status === 'DEAD' && (
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                            onClick={() => replay(delivery)}
                            title="Replay webhook payload"
                          >
                            <RotateCcw size={11} /> Replay
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
