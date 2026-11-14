import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { API, TOKEN_KEY, apiFetch } from '../../lib/api/client';
import type { AuthSession } from '../auth/useAuthActions';
import type { TeamMember } from './TeamPanel';

interface InviteLink { email: string; inviteToken: string; link: string; }
interface OwnershipTransferLink { email: string; expiresAt: string; transferToken: string; }
interface TeamActionOptions {
  setTeamMembers: Dispatch<SetStateAction<TeamMember[]>>; setSession: Dispatch<SetStateAction<AuthSession | null>>;
  refreshTeam: () => Promise<void>; setSaving: Dispatch<SetStateAction<boolean>>; notify: (message: string) => void;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
async function parse(response: Response, fallback: string): Promise<Record<string, unknown>> { const body = record(await response.json().catch(() => ({}))); if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : fallback); return body; }
export function useTeamActions({ setTeamMembers, setSession, refreshTeam, setSaving, notify }: TeamActionOptions) {
  const [latestInvite, setLatestInvite] = useState<InviteLink | null>(null);
  const [ownershipLink, setOwnershipLink] = useState<OwnershipTransferLink | null>(null);
  const inviteLink = (body: Record<string, unknown>): InviteLink => ({ email: typeof body.email === 'string' ? body.email : '', inviteToken: typeof body.inviteToken === 'string' ? body.inviteToken : '', link: `${window.location.origin}/?invite=${encodeURIComponent(typeof body.inviteToken === 'string' ? body.inviteToken : '')}` });
  const inviteMember = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); setSaving(true); setLatestInvite(null);
    try { const body = await parse(await apiFetch(`${API}/team/invitations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), role: form.get('role') }) }), 'Could not create invitation'); setLatestInvite(inviteLink(body)); await refreshTeam(); element.reset(); notify('Invitation created. Copy the activation link to share it.'); }
    catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const updateMember = async (id: string, field: 'role' | 'active', value: string | boolean): Promise<void> => {
    try { const body = await parse(await apiFetch(`${API}/team/members/${id}/${field}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(field === 'role' ? { role: value } : { active: value }) }), 'Could not update member');
      if (typeof body.id !== 'string' || typeof body.userId !== 'string' || typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.role !== 'string' || typeof body.active !== 'boolean') throw new Error('Invalid team member response'); setTeamMembers(rows => rows.map(member => member.id === id ? body as unknown as TeamMember : member)); notify('Workspace member updated');
    } catch (error: unknown) { notify(errorMessage(error)); }
  };
  const updateMemberScope = async (id: string, scope: { branchIds: string[]; managerUserId: string | null }): Promise<void> => {
    try { const body = await parse(await apiFetch(`${API}/team/members/${id}/scope`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope) }), 'Could not update team and branch scope');
      if (typeof body.id !== 'string' || typeof body.userId !== 'string') throw new Error('Invalid team member response'); setTeamMembers(rows => rows.map(member => member.id === id ? { ...member, ...body } as TeamMember : member)); notify('Member scope updated');
    } catch (error: unknown) { notify(errorMessage(error)); }
  };
  const ownershipRequest = async (payload: { targetMembershipId: string; password: FormDataEntryValue | null }): Promise<void> => {
    setSaving(true); setOwnershipLink(null); try { const body = await parse(await apiFetch(`${API}/team/ownership-transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not prepare ownership transfer');
      if (typeof body.email !== 'string' || typeof body.expiresAt !== 'string' || typeof body.transferToken !== 'string') throw new Error('Invalid ownership transfer response'); setOwnershipLink({ email: body.email, expiresAt: body.expiresAt, transferToken: body.transferToken }); notify('Ownership transfer is awaiting confirmation by the new owner');
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const resendInvitation = async (id: string): Promise<void> => {
    setSaving(true); try { setLatestInvite(inviteLink(await parse(await apiFetch(`${API}/team/invitations/${id}/resend`, { method: 'POST' }), 'Could not resend invitation'))); await refreshTeam(); notify('New invitation link created. Copy it to share with the teammate.'); }
    catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  const ownershipConfirm = async (payload: { token: FormDataEntryValue | null; password: FormDataEntryValue | null }): Promise<void> => {
    setSaving(true); try { const body = await parse(await apiFetch(`${API}/team/ownership-transfer/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Could not confirm ownership transfer');
      if (typeof body.accessToken !== 'string') throw new Error('Invalid ownership confirmation response'); const session = body as unknown as AuthSession; localStorage.setItem(TOKEN_KEY, body.accessToken); localStorage.setItem('spindl.session', JSON.stringify(body)); setSession(session); await refreshTeam(); notify('Workspace ownership transferred');
    } catch (error: unknown) { notify(errorMessage(error)); } finally { setSaving(false); }
  };
  return { latestInvite, ownershipLink, inviteMember, updateMember, updateMemberScope, ownershipRequest, resendInvitation, ownershipConfirm };
}
