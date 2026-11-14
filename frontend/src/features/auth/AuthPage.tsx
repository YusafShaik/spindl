import type { FormEventHandler } from 'react';

export type AuthMode = 'register' | 'login' | 'accept' | 'reset-request' | 'reset';

interface AuthPageProps {
  mode: AuthMode;
  busy: boolean;
  error: string;
  message: string;
  onModeChange: (mode: AuthMode) => void;
  onErrorChange: (error: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function AuthPage({ mode, busy, error, message, onModeChange, onErrorChange, onMessageChange, onSubmit }: AuthPageProps) {
  const title = mode === 'register' ? 'Set up your workspace'
    : mode === 'accept' ? 'Join your team'
      : mode === 'reset-request' || mode === 'reset' ? 'Reset your password'
        : 'Welcome back';
  const description = mode === 'register' ? 'Create your owner account to get started with Spindl.'
    : mode === 'accept' ? 'Activate your invitation and join the workspace.'
      : mode === 'reset-request' ? 'Enter your email and we’ll send a reset link if an active account exists.'
        : mode === 'reset' ? 'Choose a new password for your account.'
          : 'Sign in to continue to your Spindl workspace.';
  const submitLabel = busy ? 'Please wait…'
    : mode === 'register' ? 'Create workspace'
      : mode === 'accept' ? 'Join workspace'
        : mode === 'reset-request' ? 'Send reset link'
          : mode === 'reset' ? 'Update password'
            : 'Sign in';

  return <main className="auth-shell"><form className="auth-card" onSubmit={onSubmit}>
    <div className="auth-brand"><div className="brand-mark"><span /><span /><span /><span /></div><b>spindl</b></div>
    <div className="auth-heading"><span className="auth-eyebrow">YOUR BUSINESS WORKSPACE</span><h1>{title}</h1><p>{description}</p></div>
    {(mode === 'register' || mode === 'accept') && <label>Your name<input name="name" autoComplete="name" required maxLength={160} placeholder="Arjun Sharma" /></label>}
    {['register', 'login', 'reset-request'].includes(mode) && <label>Work email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" /></label>}
    {mode === 'register' && <label>Workspace name<input name="workspaceName" required minLength={2} maxLength={180} placeholder="Northstar Manufacturing" /></label>}
    {['register', 'login', 'accept', 'reset'].includes(mode) && <label>{mode === 'reset' ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' || mode === 'accept' || mode === 'reset' ? 12 : 1} maxLength={72} placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'} /></label>}
    {message && <div className="auth-success" role="status">{message}</div>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="button button-primary auth-submit" disabled={busy}>{submitLabel}</button>
    {mode === 'login' && <p className="auth-switch"><button type="button" onClick={() => { onModeChange('reset-request'); onErrorChange(''); onMessageChange(''); }}>Forgot password?</button></p>}
    {mode !== 'accept' && mode !== 'reset' && <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : mode === 'login' ? 'New to Spindl?' : 'Remembered your password?'} <button type="button" onClick={() => { onModeChange(mode === 'register' || mode === 'reset-request' ? 'login' : 'register'); onErrorChange(''); onMessageChange(''); }}>{mode === 'register' || mode === 'reset-request' ? 'Sign in' : 'Create a workspace'}</button></p>}
  </form></main>;
}
