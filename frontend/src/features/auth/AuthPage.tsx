import { useState, type FormEventHandler } from 'react';
import {
  Lock,
  Mail,
  User,
  Building,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

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
      ? 'Create your workspace'
      : mode === 'accept'
      ? 'Join your team'
      : mode === 'reset-request'
      ? 'Reset your password'
      : mode === 'reset'
      ? 'Set a new password'
      : 'Welcome back';

  const description =
    mode === 'register'
      ? 'Set up your organization and begin coordinating operations.'
      : mode === 'accept'
      ? 'Accept your team invitation to access shared workspaces.'
      : mode === 'reset-request'
      ? 'Enter your work email and we will send you password reset instructions.'
      : mode === 'reset'
      ? 'Choose a secure new password to regain access to your account.'
      : 'Sign in to access your projects, inventory, and ledger.';

  const submitLabel = busy
    ? 'Authenticating…'
    : mode === 'register'
    ? 'Create workspace'
    : mode === 'accept'
    ? 'Join workspace'
    : mode === 'reset-request'
    ? 'Send reset link'
    : mode === 'reset'
    ? 'Update password'
    : 'Sign in';

  return (
    <main className="auth-shell">
      <div className="auth-container">
        {/* Sleek Linear Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-logo-badge">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="auth-logo-svg"
            >
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 22L22 17" />
              <path d="M2 12L12 17L22 12" />
            </svg>
          </div>
          <div className="auth-brand-title">
            <span className="auth-brand-wordmark">Spindl</span>
            <span className="auth-brand-tag">WORKSPACE</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          {/* Segmented Control Pill Switcher for Login / Register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-segmented-nav" role="tablist">
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
                Create account
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
            <p className="auth-subtitle">{description}</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {/* Full Name for register and accept */}
            {(mode === 'register' || mode === 'accept') && (
              <div className="auth-field">
                <label htmlFor="auth-name" className="auth-label">
                  Your full name
                </label>
                <div className="auth-input-wrapper">
                  <User size={15} className="auth-input-icon" aria-hidden="true" />
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
              </div>
            )}

            {/* Email for register, login, reset-request */}
            {['register', 'login', 'reset-request'].includes(mode) && (
              <div className="auth-field">
                <label htmlFor="auth-email" className="auth-label">
                  Work email
                </label>
                <div className="auth-input-wrapper">
                  <Mail size={15} className="auth-input-icon" aria-hidden="true" />
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
              </div>
            )}

            {/* Workspace Name for register */}
            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-workspace" className="auth-label">
                  Organization / Workspace name
                </label>
                <div className="auth-input-wrapper">
                  <Building size={15} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-workspace"
                    name="workspaceName"
                    required
                    minLength={2}
                    maxLength={180}
                    placeholder="Northstar Manufacturing"
                    className="auth-input"
                  />
                </div>
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
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrapper">
                  <Lock size={15} className="auth-input-icon" aria-hidden="true" />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'register' || mode === 'accept' || mode === 'reset' ? 12 : 1}
                    maxLength={72}
                    placeholder={mode === 'login' ? 'Enter your password' : 'At least 12 characters'}
                    className="auth-input"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="auth-visibility-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
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
                <CheckCircle2 size={16} className="auth-alert-icon" />
                <span>{message}</span>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <AlertCircle size={16} className="auth-alert-icon" />
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
                  <Loader2 size={15} className="auth-spinner" />
                  <span>Please wait…</span>
                </>
              ) : (
                <>
                  <span>{submitLabel}</span>
                  <ArrowRight size={14} className="auth-submit-arrow" />
                </>
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
                  Create a workspace
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
