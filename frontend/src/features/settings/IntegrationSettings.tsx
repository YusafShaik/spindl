import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { formatAuditLabel } from '../../lib/utils/audit-format';

interface TenantApiTokensPanelProps { role?: string; notify: (message: string) => void; }
interface TenantWebhooksPanelProps { role?: string; notify: (message: string) => void; }

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

export function TenantApiTokensPanel({role,notify }: TenantApiTokensPanelProps) {
  const [tokens,setTokens]=useState<ApiTokenSummary[]>([]);const [scopes,setScopes]=useState<string[]>([]);const [selected,setSelected]=useState<string[]>([]);const [name,setName]=useState('');const [expiresInDays,setExpiresInDays]=useState('90');const [createdSecret,setCreatedSecret]=useState('');const [saving,setSaving]=useState(false);const canManage=role !== undefined && ['OWNER','ADMIN'].includes(role);const path=API+'/tenant/settings/api-tokens';
  const load=async(): Promise<void> =>{const [tokenResponse,scopeResponse]=await Promise.all([apiFetch(path),apiFetch(path+'/scopes')]);if(!tokenResponse.ok||!scopeResponse.ok)throw new Error('Could not load API tokens');const [tokenRows,scopeRows]: [ApiTokenSummary[],string[]]=await Promise.all([tokenResponse.json(),scopeResponse.json()]);setTokens(tokenRows);setScopes(scopeRows);};
  useEffect(()=>{load().catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));},[]);
  const create=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{event.preventDefault();setSaving(true);try{const response=await apiFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,scopes:selected,expiresInDays:expiresInDays?Number(expiresInDays):null})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not create API token');setCreatedSecret(body.secret);setName('');setSelected([]);await load();notify('API token created. Copy its secret now.');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setSaving(false);}};
  const revoke=async(token: ApiTokenSummary): Promise<void> =>{try{const response=await apiFetch(path+'/'+token.id,{method:'DELETE'});if(!response.ok)throw new Error('Could not revoke API token');await load();notify('API token revoked');}catch(error){notify(error instanceof Error ? error.message : String(error));}};
  const copySecret=async()=>{try{await navigator.clipboard.writeText(createdSecret);notify('API token copied');}catch{notify('Copy the token manually from the field');}};
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>API tokens</h2><p>Create scoped credentials for trusted integrations. The secret is shown once and can’t be recovered.</p></div></div>{canManage?<><form className="transaction-filters" onSubmit={create}><label>Token name<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder="Inventory sync"/></label><label>Expires after<select value={expiresInDays} onChange={event=>setExpiresInDays(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">365 days</option><option value="">No expiry</option></select></label><button className="button button-primary" disabled={saving||!name.trim()||!selected.length}>{saving?'Creating…':'Create API token'}</button><div className="report-builder-columns">{scopes.map(scope=><label key={scope}><input type="checkbox" checked={selected.includes(scope)} onChange={()=>setSelected(current=>current.includes(scope)?current.filter(value=>value!==scope):[...current,scope])}/>{formatAuditLabel(scope.replaceAll(':',' '))}</label>)}</div></form>{createdSecret&&<div className="report-builder-result-heading"><div><b>Copy this token now</b><small>It will only be displayed this time.</small></div><div className="report-builder-search"><input readOnly value={createdSecret}/><button className="mini-action" onClick={copySecret}>Copy token</button><button className="mini-action muted" onClick={()=>setCreatedSecret('')}>Dismiss</button></div></div>}</>:<p className="form-note">Only workspace owners and admins can issue or revoke API tokens.</p>}<div className="report-builder-saved"><b>Workspace tokens</b>{tokens.length?tokens.map(token=><article key={token.id}><span><strong>{token.name} · {token.tokenPrefix}…</strong><small>{token.scopes.map(scope=>formatAuditLabel(scope.replaceAll(':',' '))).join(', ')} · {token.revokedAt?'Revoked':token.expiresAt?`Expires ${new Date(token.expiresAt).toLocaleDateString()}`:'No expiry'} · {token.lastUsedAt?`Last used ${new Date(token.lastUsedAt).toLocaleString()}`:'Not used yet'}</small></span>{canManage&&!token.revokedAt&&<button className="mini-action muted" onClick={()=>revoke(token)}>Revoke</button>}</article>):<p className="empty-cell">No API tokens created.</p>}</div></section>;
}

export function TenantWebhooksPanel({role,notify }: TenantWebhooksPanelProps) {
  const [endpoints,setEndpoints]=useState<WebhookEndpoint[]>([]);const [events,setEvents]=useState<string[]>([]);const [deliveries,setDeliveries]=useState<WebhookDelivery[]>([]);const [selected,setSelected]=useState<string[]>([]);const [name,setName]=useState('');const [targetUrl,setTargetUrl]=useState('');const [secret,setSecret]=useState('');const [saving,setSaving]=useState(false);const canManage=role !== undefined && ['OWNER','ADMIN'].includes(role);const path=API+'/tenant/settings/webhooks';
  const load=async(): Promise<void> =>{const responses=await Promise.all([apiFetch(path),apiFetch(path+'/events'),apiFetch(path+'/deliveries')]);if(responses.some(response=>!response.ok))throw new Error('Could not load webhook settings');const endpointRows: WebhookEndpoint[]=await responses[0].json();const eventRows: string[]=await responses[1].json();const deliveryRows: WebhookDelivery[]=await responses[2].json();setEndpoints(endpointRows);setEvents(eventRows);setDeliveries(deliveryRows);};
  useEffect(()=>{load().catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));},[]);
  const create=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{event.preventDefault();setSaving(true);try{const response=await apiFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,targetUrl,eventTypes:selected})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not create webhook');setSecret(body.signingSecret);setName('');setTargetUrl('');setSelected([]);await load();notify('Webhook created. Copy its signing secret now.');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setSaving(false);}};
  const deactivate=async(endpoint: WebhookEndpoint): Promise<void> =>{try{const response=await apiFetch(path+'/'+endpoint.id,{method:'DELETE'});if(!response.ok)throw new Error('Could not disable webhook');await load();notify('Webhook disabled');}catch(error){notify(error instanceof Error ? error.message : String(error));}};
  const replay=async(delivery: WebhookDelivery): Promise<void> =>{try{const response=await apiFetch(path+'/deliveries/'+delivery.id+'/replay',{method:'POST'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not replay webhook');await load();notify('Delivery queued for replay');}catch(error){notify(error instanceof Error ? error.message : String(error));}};
  const copy=async()=>{try{await navigator.clipboard.writeText(secret);notify('Signing secret copied');}catch{notify('Copy the signing secret manually');}};
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Signed webhooks</h2><p>Send purchase approval events to public HTTPS endpoints. Requests include an HMAC SHA-256 signature and retry automatically with a dead-letter limit.</p></div></div>{canManage?<><form className="transaction-filters" onSubmit={create}><label>Endpoint name<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder="Purchasing automation"/></label><label>HTTPS destination<input required type="url" value={targetUrl} onChange={event=>setTargetUrl(event.target.value)} placeholder="https://example.com/hooks/spindl"/></label><button className="button button-primary" disabled={saving||!name.trim()||!targetUrl.trim()||!selected.length}>{saving?'Saving…':'Add webhook'}</button><div className="report-builder-columns">{events.map(eventType=><label key={eventType}><input type="checkbox" checked={selected.includes(eventType)} onChange={()=>setSelected(current=>current.includes(eventType)?current.filter(value=>value!==eventType):[...current,eventType])}/>{formatAuditLabel(eventType)}</label>)}</div></form>{secret&&<div className="report-builder-result-heading"><div><b>Copy the signing secret now</b><small>It is encrypted at rest and displayed once.</small></div><div className="report-builder-search"><input readOnly value={secret}/><button className="mini-action" onClick={copy}>Copy secret</button><button className="mini-action muted" onClick={()=>setSecret('')}>Dismiss</button></div></div>}</>:<p className="form-note">Only workspace owners and admins can manage webhook destinations.</p>}<div className="report-builder-saved"><b>Destinations</b>{endpoints.length?endpoints.map(endpoint=><article key={endpoint.id}><span><strong>{endpoint.name} · {endpoint.active?'Active':'Disabled'}</strong><small>{endpoint.targetUrl} · {endpoint.eventTypes.map(formatAuditLabel).join(', ')} · {endpoint.deadLetterCount} dead letter(s)</small></span>{canManage&&endpoint.active&&<button className="mini-action muted" onClick={()=>deactivate(endpoint)}>Disable</button>}</article>):<p className="empty-cell">No webhook destinations configured.</p>}</div><div className="report-builder-saved"><b>Recent delivery attempts</b>{deliveries.length?deliveries.map(delivery=><article key={delivery.id}><span><strong>{delivery.endpointName} · {formatAuditLabel(delivery.eventType)} · {formatAuditLabel(delivery.status)}</strong><small>{delivery.createdAt?new Date(delivery.createdAt).toLocaleString():''} · {delivery.attempts} attempt(s){delivery.responseStatus?` · HTTP ${delivery.responseStatus}`:''}{delivery.lastError?` · ${delivery.lastError}`:''}</small></span>{canManage&&delivery.status==='DEAD'&&<button className="mini-action" onClick={()=>replay(delivery)}>Replay</button>}</article>):<p className="empty-cell">No webhook events have been queued.</p>}</div></section>;
}
