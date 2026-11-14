import { useEffect, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { API, TOKEN_KEY, apiFetch } from '../../lib/api/client';
import type { AuthMode } from './AuthPage';
import type { AppSession } from '../../types/session';

export interface AuthSession extends AppSession { userId?: string; tenantId?: string; accessToken?: string; }
interface AuthActionState {
  authMode: AuthMode; setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  setAuthError: Dispatch<SetStateAction<string>>; setAuthMessage: Dispatch<SetStateAction<string>>; setAuthBusy: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<AuthSession | null>>; setApiOnline: Dispatch<SetStateAction<boolean>>;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function asRecord(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null; }
export function useAuthActions(state: AuthActionState) {
  const { authMode, setAuthMode, setAuthError, setAuthMessage, setAuthBusy, setSession, setApiOnline } = state;
  const submitAuth = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setAuthError(''); setAuthBusy(true); const form = new FormData(event.currentTarget);
    const payload = authMode === 'register' ? { name: form.get('name'), email: form.get('email'), password: form.get('password'), workspaceName: form.get('workspaceName') }
      : authMode === 'accept' ? { name: form.get('name'), password: form.get('password'), token: new URLSearchParams(window.location.search).get('invite') }
        : authMode === 'reset-request' ? { email: form.get('email') }
          : authMode === 'reset' ? { token: new URLSearchParams(window.location.search).get('reset'), password: form.get('password') }
            : { email: form.get('email'), password: form.get('password') };
    try {
      const endpoint = authMode === 'accept' ? '/team/invitations/accept' : authMode === 'reset-request' ? '/auth/password/forgot' : authMode === 'reset' ? '/auth/password/reset' : `/auth/${authMode}`;
      const response = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const value: unknown = await response.json().catch(() => ({})); const body = asRecord(value) ?? {};
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : 'Could not authenticate. Check your details and try again.');
      if (authMode === 'reset-request') setAuthMessage(typeof body.message === 'string' ? body.message : 'If the account exists, password reset instructions have been sent.');
      else if (authMode === 'reset') { setAuthMode('login'); setAuthMessage(typeof body.message === 'string' ? body.message : 'Password reset complete.'); window.history.replaceState({}, '', window.location.pathname); }
      else {
        const result = asRecord(body.session) ?? body;
        if (typeof result.accessToken !== 'string') throw new Error('The authentication response did not include an access token.');
        const accessToken = result.accessToken;
        const session: AuthSession = { accessToken, userId: typeof result.userId === 'string' ? result.userId : undefined, tenantId: typeof result.tenantId === 'string' ? result.tenantId : undefined, role: typeof result.role === 'string' ? result.role : undefined, name: typeof result.name === 'string' ? result.name : undefined, tenantName: typeof result.tenantName === 'string' ? result.tenantName : undefined };
        localStorage.setItem(TOKEN_KEY, accessToken); localStorage.setItem('spindl.session', JSON.stringify(session)); setSession(session);
      }
    } catch (error: unknown) { setAuthError(message(error)); } finally { setAuthBusy(false); }
  };
  const signOut = async (): Promise<void> => { try { await apiFetch(`${API}/auth/logout`, { method: 'POST' }); } finally { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('spindl.session'); setSession(null); setApiOnline(false); } };
  useEffect(() => { const unauthorized = () => { setSession(null); setApiOnline(false); }; window.addEventListener('spindl:unauthorized', unauthorized); return () => window.removeEventListener('spindl:unauthorized', unauthorized); }, [setSession, setApiOnline]);
  return { submitAuth, signOut };
}
