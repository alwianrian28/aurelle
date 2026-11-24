import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocalePath } from '../../hooks/useLocale';
import { AuthField, AuthHeading, AuthShell, GoogleButton, PasswordField } from './AuthParts';

/**
 * F-01 Register — email, password, nama (FR-01-02), lalu email verifikasi dikirim.
 * Akun email wajib terverifikasi sebelum checkout/pembayaran (FR-01-03).
 */
export default function Register() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const location = useLocation();
  const register = useAuthStore((s) => s.register);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ email: '', username: '', password: '', newsletter: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? path('/store');
  const benefits = t('authPage.benefits', { returnObjects: true }) as string[];

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.username.trim().length < 3) next.username = t('authPage.nameMin');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = t('auth.invalidEmail');
    if (form.password.length < 8) next.password = t('auth.passwordMin');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    const res = await register(form.email, form.username.trim(), form.password, form.newsletter);
    if (!res.ok) {
      setFormError(t(res.reason === 'email_in_use' ? 'authPage.emailInUse' : res.reason === 'network' ? 'authPage.networkError' : 'auth.genericError'));
      return;
    }
    // FR-01-02: the API emails a verification link; outside production it also returns the
    // token so the flow can be finished without an email provider.
    setVerifyToken(res.devToken ?? '');
    setSubmitted(true);
  };

  const side = (
    <ul className="auth-shell__benefits">
      {benefits.map((benefit) => (
        <li key={benefit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4L19 7" /></svg>
          {benefit}
        </li>
      ))}
    </ul>
  );

  if (submitted) {
    return (
      <AuthShell title={t('auth.verifyTitle')} photo="register" sideTitle={t('authPage.registerSideTitle')} side={side}>
        <AuthHeading eyebrow={t('auth.verifyEyebrow')} title={t('auth.verifyTitle')}>{t('auth.verifyBody', { email: form.email })}</AuthHeading>
        {verifyToken && <p className="auth-note">
          {t('authFlow.devNote')}{' '}
          <NavLink id="register-demo-verify" to={path(`/auth/verify-email?token=${verifyToken}`)}>{t('authFlow.simulateVerifyLink')}</NavLink>
        </p>}
        <button type="button" id="register-continue" className="auth-btn" onClick={() => navigate(from, { replace: true })}>{t('common.continue')}</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('authPage.registerTitle')} photo="register" sideTitle={t('authPage.registerSideTitle')} side={side} legal={false}>
      <AuthHeading eyebrow={t('authPage.registerEyebrow')} title={t('authPage.registerTitle')}>{t('authPage.registerBody')}</AuthHeading>

      <GoogleButton
        id="register-google"
        label={t('auth.registerGoogle')}
        onClick={() => setFormError(t('authPage.googleUnavailable'))}
      />
      <div className="auth-divider"><span>{t('auth.or')}</span></div>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <AuthField
          id="register-name"
          label={t('authPage.fullName')}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder={t('authPage.namePlaceholder')}
          error={errors.username}
          autoComplete="name"
        />
        <AuthField
          id="register-email"
          label={t('auth.email')}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t('authPage.emailPlaceholder')}
          error={errors.email}
          autoComplete="email"
        />
        <PasswordField
          id="register-password"
          label={t('auth.password')}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={t('authPage.createPlaceholder')}
          error={errors.password}
          hint={t('authPage.passwordHint')}
          autoComplete="new-password"
        />
        <label className="auth-check">
          <input id="register-newsletter" type="checkbox" checked={form.newsletter} onChange={(e) => setForm({ ...form, newsletter: e.target.checked })} />
          <span>{t('authPage.newsletter')}</span>
        </label>
        {formError && <p className="auth-error" role="alert">{formError}</p>}
        <button type="submit" id="register-submit" className="auth-btn">{t('authPage.registerSubmit')}</button>
      </form>

      <p className="auth-terms">
        {t('authPage.agree')} <NavLink to={path('/policies/terms')}>{t('footer.terms')}</NavLink> {t('authPage.and')} <NavLink to={path('/policies/privacy')}>{t('footer.privacy')}</NavLink>.
      </p>
      <p className="auth-switch">
        {t('authPage.haveAccount')} <NavLink id="register-login" to={path('/auth/login')} state={location.state}>{t('authPage.loginSubmit')}</NavLink>
      </p>
    </AuthShell>
  );
}
