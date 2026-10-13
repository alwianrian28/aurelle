import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocalePath } from '../../hooks/useLocale';
import { GoogleIcon } from './Login';
import { AUTH_PARAMS } from '../../config/auth';
import { issueToken } from '../../utils/demoToken';
import './Auth.css';

/**
 * F-01 Register — email, password, username (FR-01-02), lalu email verifikasi dikirim.
 * Akun email wajib terverifikasi sebelum checkout/pembayaran (FR-01-03).
 */
export default function Register() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, loginWithGoogle } = useAuthStore();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? path('/');

  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = t('auth.invalidEmail');
    if (form.username.trim().length < 3) next.username = t('auth.usernameMin');
    if (form.password.length < 8) next.password = t('auth.passwordMin');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await register(form.email, form.username, form.password);
    // FR-01-02: tautan verifikasi dikirim setelah register (demo: token sekali pakai lokal).
    setVerifyToken(issueToken('verify', form.email, AUTH_PARAMS.verifyTokenTtlMin));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="auth-page container">
        <div className="auth-card card">
          <p className="eyebrow">{t('auth.verifyEyebrow')}</p>
          <h1 className="heading-lg">{t('auth.verifyTitle')}</h1>
          <p className="text-muted">{t('auth.verifyBody', { email: form.email })}</p>
          <p className="alert alert--info">
            <span>
              {t('authFlow.demoNote')}{' '}
              <NavLink id="register-demo-verify" to={path(`/auth/verify-email?token=${verifyToken}`)}>
                {t('authFlow.simulateVerifyLink')}
              </NavLink>
            </span>
          </p>
          <button className="btn btn--outline btn--block" onClick={() => navigate(from, { replace: true })}>
            {t('common.continue')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page container">
      <div className="auth-card card">
        <p className="eyebrow">Aurelle</p>
        <h1 className="heading-lg">{t('common.register')}</h1>

        <button
          className="btn btn--outline btn--block auth-google"
          onClick={async () => {
            await loginWithGoogle();
            navigate(from, { replace: true });
          }}
        >
          <GoogleIcon /> {t('auth.registerGoogle')}
        </button>

        <div className="auth-divider">
          <span>{t('auth.or')}</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label>
            {t('auth.email')}
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
            {errors.email && <span className="auth-field-error">{errors.email}</span>}
          </label>
          <label>
            {t('auth.username')}
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              aria-invalid={!!errors.username}
              autoComplete="username"
            />
            {errors.username && <span className="auth-field-error">{errors.username}</span>}
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              aria-invalid={!!errors.password}
              autoComplete="new-password"
            />
            {errors.password && <span className="auth-field-error">{errors.password}</span>}
          </label>
          <button type="submit" className="btn btn--primary btn--block">
            {t('common.register')}
          </button>
        </form>

        <div className="auth-links">
          <span className="text-muted">{t('auth.haveAccount')}</span>
          <NavLink to={path('/auth/login')} state={location.state}>
            {t('common.login')}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
