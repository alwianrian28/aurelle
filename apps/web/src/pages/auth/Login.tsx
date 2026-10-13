import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocalePath } from '../../hooks/useLocale';
import { useCountdown } from '../../hooks/useCountdown';
import { AUTH_PARAMS } from '../../config/auth';
import './Auth.css';

/** AC-01-06 (UX saja — penegakan sesungguhnya di backend): hitung gagal login per sesi browser. */
const THROTTLE_KEY = 'aurelle_login_throttle';
function readThrottle(): { fails: number; lockedUntil?: string } {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(THROTTLE_KEY) ?? 'null');
    if (v && typeof v === 'object' && typeof (v as { fails?: unknown }).fails === 'number') return v as { fails: number; lockedUntil?: string };
  } catch {
    /* storage rusak → mulai dari nol */
  }
  return { fails: 0 };
}

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
  const { loginWithEmail, loginWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(() => readThrottle().lockedUntil);
  const lockRemaining = useCountdown(lockedUntil);
  const locked = lockRemaining > 0;

  const from = (location.state as { from?: string } | null)?.from ?? path('/');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setLoading(true);
    setError(null);
    const res = await loginWithEmail(email, password);
    setLoading(false);
    if (!res.ok) {
      const fails = readThrottle().fails + 1;
      if (fails >= AUTH_PARAMS.loginMaxAttempts) {
        const until = new Date(Date.now() + AUTH_PARAMS.loginLockSec * 1000).toISOString();
        sessionStorage.setItem(THROTTLE_KEY, JSON.stringify({ fails: 0, lockedUntil: until }));
        setLockedUntil(until);
      } else {
        sessionStorage.setItem(THROTTLE_KEY, JSON.stringify({ fails }));
      }
      setError(t('auth.genericError')); // generik — tidak mengungkap apakah email terdaftar
      return;
    }
    sessionStorage.removeItem(THROTTLE_KEY);
    navigate(from, { replace: true });
  };

  const handleGoogle = async () => {
    setLoading(true);
    await loginWithGoogle();
    setLoading(false);
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page container">
      <div className="auth-card card">
        <p className="eyebrow">Aurelle</p>
        <h1 className="heading-lg">{t('common.login')}</h1>

        <button
          className="btn btn--outline btn--block auth-google"
          onClick={handleGoogle}
          disabled={loading}
          id="login-google"
        >
          <GoogleIcon /> {t('auth.continueGoogle')}
        </button>

        <div className="auth-divider">
          <span>{t('auth.or')}</span>
        </div>

        <form onSubmit={handleEmail} className="auth-form" noValidate>
          <label>
            {t('auth.email')}
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            {t('auth.password')}
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {locked ? (
            <p className="auth-error" role="alert" id="login-throttled">
              {t('authFlow.throttled', { seconds: Math.ceil(lockRemaining / 1000) })}
            </p>
          ) : (
            error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={loading || locked} id="login-submit">
            {loading ? t('common.loading') : t('common.login')}
          </button>
        </form>

        <div className="auth-links">
          <NavLink to={path('/auth/forgot-password')}>{t('auth.forgot')}</NavLink>
          <NavLink to={path('/auth/register')} state={location.state}>
            {t('common.register')}
          </NavLink>
        </div>
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
