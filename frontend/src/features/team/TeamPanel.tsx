import { useEffect, useState, type FormEvent } from 'react';
import { API, apiFetch } from '../../lib/api/client';
import { Status } from '../../components/ui/Status';
import type { TenantBranchSummary } from '../../types/crm';

export interface TeamMember { id: string; userId: string; name: string; email: string; role: string; active: boolean; branchIds?: string[]; managerUserId?: string | null; }
export interface TeamInvitation { id: string; email: string; role: string; expiresAt: string; accepted: boolean; }
interface TeamBranch extends TenantBranchSummary { active: boolean; }
export interface TeamRole { roleCode: string; displayName: string; }
interface TeamSession { role?: string; }
interface InviteLink { email: string; link: string; }
interface OwnershipLink { email: string; expiresAt: string; transferToken: string; }
type MemberScope = { branchIds: string[]; managerUserId: string | null };
interface TeamPanelProps {
  members: TeamMember[]; invitations: TeamInvitation[]; roles: TeamRole[]; latestInvite: InviteLink | null;
  loading: boolean; saving: boolean; session: TeamSession | null; ownershipLink: OwnershipLink | null;
  onInvite: (event: FormEvent<HTMLFormElement>) => void; onRole: (id: string, role: string) => void;
  onActive: (id: string, active: boolean) => void; onScope: (id: string, scope: MemberScope) => void;
  onCopy: (message?: string) => void; onOwnershipRequest: (payload: { targetMembershipId: string; password: FormDataEntryValue | null }) => void;
  onOwnershipConfirm: (payload: { token: FormDataEntryValue | null; password: FormDataEntryValue | null }) => void;
  onResend: (id: string) => void;
}
function isBranch(value: unknown): value is TeamBranch { return value !== null && typeof value === 'object' && 'id' in value && 'name' in value && 'active' in value && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.active === 'boolean'; }

export function TeamPanel({ members, invitations, roles, latestInvite, loading, saving, session, ownershipLink, onInvite, onRole, onActive, onScope, onCopy, onOwnershipRequest, onOwnershipConfirm, onResend }: TeamPanelProps) {
  const [targetMembershipId,setTargetMembershipId]=useState('');
  const [branches,setBranches]=useState<TeamBranch[]>([]);
  useEffect(()=>{apiFetch(`${API}/tenant/branches`).then(response=>response.ok?response.json():[]).then((rows: unknown)=>setBranches(Array.isArray(rows)?rows.filter(isBranch):[])).catch(()=>setBranches([]));},[]);
  return <div className="team-layout">
    <section className="panel team-invite-panel"><div className="panel-header"><div><h2>Invite a teammate</h2><p>Create a one-time activation link that expires in seven days.</p></div></div>
      <form className="team-invite-form" onSubmit={onInvite}><label>Work email<input type="email" name="email" required maxLength={254} placeholder="teammate@company.com"/></label><label>Workspace role<select name="role" defaultValue="VIEWER">{roles.filter(item=>item.roleCode!=='OWNER').map(item=><option key={item.roleCode} value={item.roleCode}>{item.displayName}</option>)}</select></label><button className="button button-primary" disabled={saving}>{saving?'Creating…':'Create invite'}</button></form>
      {latestInvite && <div className="team-invite-link"><div><b>Invitation link ready</b><small>Share this link with {latestInvite.email}. The invite token is shown only once.</small><code>{latestInvite.link}</code></div><button className="button button-secondary" onClick={() => onCopy()}>Copy link</button></div>}
    </section>
    <section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Workspace members <span className="record-count">{members.length}</span></h2><p>Update access for people in this workspace.</p></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
      {loading ? <tr><td className="empty-cell" colSpan={5}>Loading workspace team…</td></tr> : members.length ? members.map(member=><tr key={member.id}><td><b>{member.name}</b></td><td>{member.email}</td><td><select className="team-role-select" value={member.role} disabled={member.role==='OWNER'} onChange={event=>onRole(member.id,event.target.value)}>{roles.map(item=><option key={item.roleCode} value={item.roleCode}>{item.displayName}</option>)}</select></td><td><Status label={member.active?'Active':'Inactive'}/></td><td>{member.role==='OWNER' ? <span className="team-owner-label">Workspace owner</span> : <><button className="mini-action" onClick={()=>onActive(member.id,!member.active)}>{member.active?'Deactivate':'Reactivate'}</button><details className="member-scope-details"><summary>Team & branch scope</summary><label>Assigned branches<select multiple value={(member.branchIds||[]).map(String)} onChange={event=>onScope(member.id,{branchIds:Array.from(event.target.selectedOptions,option=>option.value),managerUserId:member.managerUserId||null})}>{branches.filter(branch=>branch.active).map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Reports to<select value={member.managerUserId||''} onChange={event=>onScope(member.id,{branchIds:(member.branchIds||[]).map(String),managerUserId:event.target.value||null})}><option value="">No team manager</option>{members.filter(candidate=>candidate.active&&candidate.userId!==member.userId&&candidate.role!=='VIEWER').map(candidate=><option key={candidate.userId} value={candidate.userId}>{candidate.name}</option>)}</select></label></details></>}</td></tr>) : <tr><td className="empty-cell" colSpan={5}>No workspace members found.</td></tr>}
    </tbody></table></div></section>
    <section className="panel directory-panel"><div className="panel-header directory-top"><div><h2>Invitations <span className="record-count">{invitations.filter(invite=>!invite.accepted).length}</span></h2><p>Invitation tokens are never stored in readable form. Resending creates a fresh one-time token.</p></div></div><div className="table-scroll"><table><thead><tr><th>EMAIL</th><th>ROLE</th><th>EXPIRES</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{invitations.length?invitations.map(invite=><tr key={invite.id}><td>{invite.email}</td><td>{invite.role}</td><td>{new Date(invite.expiresAt).toLocaleDateString()}</td><td><Status label={invite.accepted?'Accepted':new Date(invite.expiresAt)<new Date()?'Expired':'Pending'}/></td><td>{!invite.accepted&&<button className="mini-action" onClick={()=>onResend(invite.id)}>Resend invite</button>}</td></tr>):<tr><td className="empty-cell" colSpan={5}>No invitations yet.</td></tr>}</tbody></table></div></section>
    <section className="panel team-invite-panel"><div className="panel-header"><div><h2>Transfer workspace ownership</h2><p>Requires the current owner’s password and confirmation by the new owner within 24 hours. Transfer link is shown once.</p></div></div>
      {session?.role==='OWNER'&&<>
      <form className="team-invite-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);onOwnershipRequest({targetMembershipId,password:form.get('password')});event.currentTarget.reset();}}>
        <label>New owner<select required value={targetMembershipId} onChange={event=>setTargetMembershipId(event.target.value)}><option value="">Choose an active admin or manager</option>{members.filter(member=>member.active&&['ADMIN','MANAGER'].includes(member.role)).map(member=><option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
        <label>Confirm your password<input type="password" name="password" required autoComplete="current-password"/></label><button className="button button-primary" disabled={saving||!targetMembershipId}>{saving?'Preparing…':'Request transfer'}</button>
      </form>{ownershipLink&&<div className="team-invite-link"><div><b>Confirmation token ready for {ownershipLink.email}</b><small>Share this one-time token with the new owner. It expires {new Date(ownershipLink.expiresAt).toLocaleString()}.</small><code>{ownershipLink.transferToken}</code></div><button className="button button-secondary" onClick={()=>navigator.clipboard.writeText(ownershipLink.transferToken).then(()=>onCopy('Transfer token copied'))}>Copy token</button></div>}
      </>}
      <form className="team-invite-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);onOwnershipConfirm({token:form.get('token'),password:form.get('password')});event.currentTarget.reset();}}>
        <label>Confirm a transfer to you<input name="token" required placeholder="Paste the token shared by the current owner"/></label><label>Your password<input type="password" name="password" required autoComplete="current-password"/></label><button className="button button-secondary" disabled={saving}>Confirm ownership</button>
      </form>
    </section>
  </div>;
}

