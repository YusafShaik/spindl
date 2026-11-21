import { useState, type FormEventHandler } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { SpindlLogo } from '../../components/ui/SpindlLogo';

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

export function AuthPage({
  mode,
  busy,
  error,
  message,
  onModeChange,
  onErrorChange,
  onMessageChange,
  onSubmit,
}: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (newMode: AuthMode) => {
    onModeChange(newMode);
    onErrorChange('');
    onMessageChange('');
  };

  const title =
    mode === 'register'
      ? 'Sign up'
      : mode === 'accept'
      ? 'Join team'
      : mode === 'reset-request'
      ? 'Reset password'
      : mode === 'reset'
      ? 'Set password'
      : 'Sign in';

  const description =
    mode === 'accept'
      ? 'Accept your team invitation to join the organization.'
      : mode === 'reset-request'
      ? 'Enter your work email and we will send you password reset instructions.'
      : mode === 'reset'
      ? 'Choose a secure new password (min. 12 characters).'
      : '';

  const submitLabel = busy
    ? 'Authenticating…'
    : mode === 'register'
    ? 'Sign up'
    : mode === 'accept'
    ? 'Join team'
    : mode === 'reset-request'
    ? 'Send reset link'
    : mode === 'reset'
    ? 'Update password'
    : 'Sign in';

  return (
    <main className="auth-shell">
      <div className="auth-container">
        {/* Minimal Linear Header: Logo and Spindl Side by Side */}
        <div className="auth-brand-header">
          <SpindlLogo size={24} />
          <span className="auth-brand-wordmark">Spindl</span>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          {/* Segmented Control Pill Switcher for Sign in / Sign up */}
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-segmented-nav" role="tablist" aria-label="Sign in or sign up">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-segment-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => mode !== 'login' && switchMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`auth-segment-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => mode !== 'register' && switchMode('register')}
              >
                Sign up
              </button>
            </div>
          )}

          {/* Back button for reset modes */}
          {(mode === 'reset-request' || mode === 'reset') && (
            <button
              type="button"
              className="auth-back-nav"
              onClick={() => switchMode('login')}
            >
              <ArrowLeft size={13} />
              <span>Back to sign in</span>
            </button>
          )}

          <div className="auth-heading">
            <h1 className="auth-title">{title}</h1>
            {description && <p className="auth-subtitle">{description}</p>}
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {/* Full Name for register and accept */}
            {(mode === 'register' || mode === 'accept') && (
              <div className="auth-field">
                <label htmlFor="auth-name" className="auth-label">
                  Full name
                </label>
                <input
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={160}
                  placeholder="Arjun Sharma"
                  className="auth-input"
                />
              </div>
            )}

            {/* Email for register, login, reset-request */}
            {['register', 'login', 'reset-request'].includes(mode) && (
              <div className="auth-field">
                <label htmlFor="auth-email" className="auth-label">
                  Email
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="name@company.com"
                  className="auth-input"
                />
              </div>
            )}

            {/* Workspace / Org Name for register */}
            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-workspace" className="auth-label">
                  Organization name
                </label>
                <input
                  id="auth-workspace"
                  name="workspaceName"
                  required
                  minLength={2}
                  maxLength={180}
                  placeholder="Acme Corp"
                  className="auth-input"
                />
              </div>
            )}

            {/* Password for register, login, accept, reset */}
            {['register', 'login', 'accept', 'reset'].includes(mode) && (
              <div className="auth-field">
                <div className="auth-field-header">
                  <label htmlFor="auth-password" className="auth-label">
                    {mode === 'reset' ? 'New password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => switchMode('reset-request')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrapper">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'register' || mode === 'accept' || mode === 'reset' ? 12 : 1}
                    maxLength={72}
                    placeholder={mode === 'login' ? 'Password' : 'At least 12 characters'}
                    className="auth-input auth-input-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="auth-visibility-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {mode === 'register' && (
                  <span className="auth-hint">Must be at least 12 characters</span>
                )}
              </div>
            )}

            {/* Success Message Alert */}
            {message && (
              <div className="auth-alert auth-alert-success" role="status">
                <CheckCircle2 size={15} className="auth-alert-icon" />
                <span>{message}</span>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <AlertCircle size={15} className="auth-alert-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="button button-primary auth-submit-btn"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="auth-spinner" />
                  <span>Please wait…</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </form>

          {/* Mode Switch Navigation Footer inside card */}
          <div className="auth-card-footer">
            {mode === 'login' && (
              <p className="auth-switch-text">
                Don’t have an account?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => switchMode('register')}
                >
                  Sign up
                </button>
              </p>
            )}

            {mode === 'register' && (
              <p className="auth-switch-text">
                Already have an account?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </button>
              </p>
            )}

            {(mode === 'reset-request' || mode === 'reset') && (
              <p className="auth-switch-text">
                Remembered your password?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Global Security & Legal Footnote */}
        <div className="auth-meta-footer">
          <div className="auth-security-badge">
            <ShieldCheck size={13} className="auth-security-icon" />
            <span>256-bit TLS encryption • Enterprise compliance</span>
          </div>
          <div className="auth-meta-links">
            <span>© 2026 Spindl ERP</span>
            <span className="auth-meta-dot">•</span>
            <span className="auth-meta-dim">System status: All operational</span>
          </div>
        </div>
      </div>
    </main>
  );
}
