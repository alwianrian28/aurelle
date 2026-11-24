import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocalePath } from '../../hooks/useLocale';
import { useCountdown } from '../../hooks/useCountdown';
import { AuthField, AuthHeading, AuthShell, GoogleButton, PasswordField } from './AuthParts';

/**
 * F-01 Login — Google atau email/password (BR-03).
 * Setelah login, pengguna kembali ke halaman asal (FR-01-08).
 * Pesan error dibuat generik (FR-01-07).
 */
export default function Login() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const location = useLocation();
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Lock after repeated failures is decided by the server (AC-01-06); this only mirrors it.
  const [lockedUntil, setLockedUntil] = useState<string>();
  const lockRemaining = useCountdown(lockedUntil);
  const locked = lockRemaining > 0;

  const from = (location.state as { from?: string } | null)?.from ?? path('/store');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setLoading(true);
    setError(null);
    const res = await loginWithEmail(email, password, keep);
    setLoading(false);
    if (!res.ok) {
      if (res.retryAfterMs) setLockedUntil(new Date(Date.now() + res.retryAfterMs).toISOString());
      // Generic on purpose: never reveals whether the email is registered (FR-01-07).
      setError(t(res.reason === 'network' ? 'authPage.networkError' : 'auth.genericError'));
      return;
    }
    navigate(from, { replace: true });
  };

  // No OAuth client is configured yet, so the button explains instead of pretending.
  const handleGoogle = () => setError(t('authPage.googleUnavailable'));

  return (
    <AuthShell
      title={t('authPage.loginTitle')}
      photo="login"
      sideTitle={t('authPage.loginSideTitle')}
      side={<p>{t('footer.tagline')}</p>}
    >
      <AuthHeading eyebrow={t('authPage.loginEyebrow')} title={t('authPage.loginTitle')}>{t('authPage.loginBody')}</AuthHeading>

      <GoogleButton id="login-google" label={t('auth.continueGoogle')} disabled={loading} onClick={handleGoogle} />
      <div className="auth-divider"><span>{t('auth.or')}</span></div>

      <form onSubmit={handleEmail} className="auth-form" noValidate>
        <AuthField
          id="login-email"
          label={t('auth.email')}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('authPage.emailPlaceholder')}
          autoComplete="email"
        />
        <PasswordField
          id="login-password"
          label={t('auth.password')}
          aside={<NavLink id="login-forgot" to={path('/auth/forgot-password')}>{t('auth.forgot')}</NavLink>}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('authPage.passwordPlaceholder')}
          autoComplete="current-password"
        />
        <label className="auth-check">
          <input id="login-keep" type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <span>{t('authPage.keep')}</span>
        </label>
        {locked ? (
          <p className="auth-error" role="alert" id="login-throttled">
            {t('authFlow.throttled', { seconds: Math.ceil(lockRemaining / 1000) })}
          </p>
        ) : (
          error && <p className="auth-error" role="alert">{error}</p>
        )}
        <button type="submit" className="auth-btn" disabled={loading || locked} id="login-submit">
          {loading ? t('common.loading') : t('authPage.loginSubmit')}
        </button>
      </form>

      <p className="auth-switch">
        {t('authPage.newHere')} <NavLink id="login-register" to={path('/auth/register')} state={location.state}>{t('authPage.create')}</NavLink>
      </p>
    </AuthShell>
  );
}
