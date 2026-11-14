import { useEffect, useState } from 'react';
import { API, apiFetch } from '../lib/api/client';
import type { TeamInvitation, TeamMember, TeamRole } from '../features/team/TeamPanel';

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isTeamMember(value: unknown): value is TeamMember { return isRecord(value) && typeof value.id === 'string' && typeof value.userId === 'string' && typeof value.name === 'string' && typeof value.email === 'string' && typeof value.role === 'string' && typeof value.active === 'boolean'; }
function isTeamInvitation(value: unknown): value is TeamInvitation { return isRecord(value) && typeof value.id === 'string' && typeof value.email === 'string' && typeof value.role === 'string' && typeof value.expiresAt === 'string' && typeof value.accepted === 'boolean'; }
function isTeamRole(value: unknown): value is TeamRole { return isRecord(value) && typeof value.roleCode === 'string' && typeof value.displayName === 'string'; }
function messageFrom(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function useTeamData(section: string, session: unknown, notify: (message: string) => void) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const refreshTeam = async (): Promise<void> => {
    const responses = await Promise.all([apiFetch(`${API}/team/members`), apiFetch(`${API}/team/invitations`), apiFetch(`${API}/tenant/roles`)]);
    const rows: unknown[] = await Promise.all(responses.map((response) => response.json()));
    const [members, invitations, roles] = rows;
    if (!Array.isArray(members) || !members.every(isTeamMember) || !Array.isArray(invitations) || !invitations.every(isTeamInvitation) || !Array.isArray(roles) || !roles.every(isTeamRole)) throw new Error('Invalid workspace team response');
    setTeamMembers(members); setTeamInvitations(invitations); setTeamRoles(roles);
  };
  useEffect(() => {
    if (section !== 'Team' || !session) return;
    let current = true;
    setTeamLoading(true);
    void Promise.all([apiFetch(`${API}/team/members`), apiFetch(`${API}/team/invitations`), apiFetch(`${API}/tenant/roles`)]).then(async (responses) => {
      if (responses.some((response) => !response.ok)) throw new Error('You need workspace admin access to manage the team.');
      const [members, invitations, roles]: unknown[] = await Promise.all(responses.map((response) => response.json()));
      if (!Array.isArray(members) || !members.every(isTeamMember) || !Array.isArray(invitations) || !invitations.every(isTeamInvitation) || !Array.isArray(roles) || !roles.every(isTeamRole)) throw new Error('Invalid workspace team response');
      if (current) { setTeamMembers(members); setTeamInvitations(invitations); setTeamRoles(roles); }
    }).catch((error: unknown) => { if (current) notify(messageFrom(error)); }).finally(() => { if (current) setTeamLoading(false); });
    return () => { current = false; };
  }, [section, session]);
  return { teamMembers, setTeamMembers, teamInvitations, setTeamInvitations, teamRoles, setTeamRoles, teamLoading, refreshTeam };
}
