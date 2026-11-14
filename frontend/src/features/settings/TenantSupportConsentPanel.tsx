import { useEffect, useState } from 'react';
import { API, apiFetch } from '../../lib/api/client';

interface TenantSupportConsentPanelProps { role?: string; notify: (message: string) => void; }
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

export function TenantSupportConsentPanel({role,notify }: TenantSupportConsentPanelProps) {
  const [rows,setRows]=useState<SupportConsentRequest[]>([]);const [busy,setBusy]=useState(false);const canReview=role !== undefined && ['OWNER','ADMIN'].includes(role);
  const load=async(): Promise<void> =>{const response=await apiFetch(`${API}/tenant/settings/support-requests`);if(!response.ok)throw new Error('Could not load support access requests');setRows(await response.json());};
  useEffect(()=>{if(canReview)load().catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));},[canReview]);
  const decide=async(id: string,action: 'approve'|'reject'|'revoke'): Promise<void> =>{let note=null;if(action==='reject'){note=window.prompt('Why are you rejecting this support request?');if(!note?.trim())return;}else if(action==='revoke')note=window.prompt('Optional reason for revoking support access')||null;setBusy(true);try{const response=await apiFetch(`${API}/tenant/settings/support-requests/${id}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not update support access');await load();notify(action==='approve'?'Read-only support diagnostics approved for a limited time':action==='revoke'?'Support access revoked':'Support request rejected');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setBusy(false);}};
  if(!canReview)return null;
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Support access consent</h2><p>Support staff cannot impersonate workspace users. Approving grants the named operator read-only diagnostics access for the requested time, up to 60 minutes.</p></div></div>{rows.length?rows.map(row=><div className="team-invite-link" key={row.id}><div><b>{row.requesterEmail} · {row.status}</b><small>{row.reason} · requested {row.durationMinutes} minutes · {row.createdAt?new Date(row.createdAt).toLocaleString():''}{row.expiresAt?` · expires ${new Date(row.expiresAt).toLocaleString()}`:''}{row.reviewNote?` · ${row.reviewNote}`:''}</small></div>{row.status==='REQUESTED'&&<div className="import-actions"><button className="mini-action" disabled={busy} onClick={()=>decide(row.id,'approve')}>Approve</button><button className="mini-action muted" disabled={busy} onClick={()=>decide(row.id,'reject')}>Reject</button></div>}{row.status==='APPROVED'&&row.expiresAt&&new Date(row.expiresAt)>new Date()&&<button className="mini-action muted" disabled={busy} onClick={()=>decide(row.id,'revoke')}>Revoke access</button>}</div>):<p className="empty-cell">No support access requests for this workspace.</p>}</section>;
}
