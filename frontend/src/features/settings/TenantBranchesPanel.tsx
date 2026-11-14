import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';

interface TenantBranchesPanelProps { role?: string; notify: (message: string) => void; }
interface TenantBranchRecord {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  taxRegistration: string | null;
  active: boolean;
  defaultBranch: boolean;
}

export function TenantBranchesPanel({role,notify }: TenantBranchesPanelProps) {
  const [branches,setBranches]=useState<TenantBranchRecord[]>([]);const [busy,setBusy]=useState(false);const canEdit=role !== undefined && ['OWNER','ADMIN'].includes(role);
  const load=async(): Promise<void> =>{const response=await apiFetch(`${API}/tenant/branches`);if(!response.ok)throw new Error('Could not load workspace branches');setBranches(await response.json());};
  useEffect(()=>{if(canEdit)load().catch((error: unknown)=>notify(error instanceof Error ? error.message : String(error)));},[canEdit]);
  const create=async (event: FormEvent<HTMLFormElement>): Promise<void> =>{event.preventDefault();const element=event.currentTarget;const form=new FormData(element);setBusy(true);try{const response=await apiFetch(`${API}/tenant/branches`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:form.get('code'),name:form.get('name'),legalName:form.get('legalName')||null,taxRegistration:form.get('taxRegistration')||null})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not create branch');element.reset();await load();notify('Branch created');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setBusy(false);}};
  const setActive=async (branch: TenantBranchRecord): Promise<void> =>{setBusy(true);try{const response=await apiFetch(`${API}/tenant/branches/${branch.id}/active`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!branch.active})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||body.message||'Could not update branch');await load();notify(branch.active?'Branch deactivated':'Branch activated');}catch(error){notify(error instanceof Error ? error.message : String(error));}finally{setBusy(false);}};
  if(!canEdit)return null;
  return <section className="panel tenant-settings-panel"><div className="panel-header"><div><h2>Branches</h2><p>Manage workspace locations. The default branch is retained for existing records.</p></div></div><form className="tenant-settings-form" onSubmit={create}><label>Branch code<input name="code" required maxLength={40} placeholder="NORTH"/></label><label>Branch name<input name="name" required maxLength={120} placeholder="North shop"/></label><label>Legal name<input name="legalName" maxLength={180}/></label><label>Tax registration<input name="taxRegistration" maxLength={80}/></label><button className="button button-primary" disabled={busy}>{busy?'Saving…':'Add branch'}</button></form><div className="tenant-modules-grid">{branches.map(branch=><article className="tenant-module-card" key={branch.id}><div><b>{branch.name} · {branch.code}</b><small>{branch.legalName||'No legal name'}{branch.taxRegistration?` · ${branch.taxRegistration}`:''}</small></div><span className={`module-state ${branch.active?'enabled':''}`}>{branch.defaultBranch?'Default':branch.active?'Active':'Inactive'}</span>{!branch.defaultBranch&&<button className="mini-action" disabled={busy} onClick={()=>setActive(branch)}>{branch.active?'Deactivate':'Activate'}</button>}</article>)}</div></section>;
}
