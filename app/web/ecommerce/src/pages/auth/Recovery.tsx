import { useEffect, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../../hooks/useLocale';
import { useAuthStore, type TokenResult } from '../../store/authStore';
import { useCountdown } from '../../hooks/useCountdown';
import { AUTH_PARAMS } from '../../config/auth';
import { api } from '../../lib/api';
import ChatLink from '../../components/ChatLink';
import Icon from '../../components/ServiceIcons';
import { AuthField, AuthHeading, AuthShell, PasswordField } from './AuthParts';

type Mode = 'verify' | 'forgot' | 'reset';

function cooldownTarget() {
  return new Date(Date.now() + AUTH_PARAMS.resendCooldownSec * 1000).toISOString();
}

/**
 * F-01 pemulihan akun — verifikasi email, lupa password, reset password.
 * FR-01-03 (verifikasi sebelum checkout/pembayaran), FR-01-06 / AC-01-05 (token sekali pakai &
 * kedaluwarsa), FR-01-07 / AC-01-06 (pesan tidak mengungkap apakah email terdaftar).
 * Mode demo: belum ada layanan email; token disimpan di sessionStorage dan tautan ditampilkan di layar.
 */
export default function Recovery({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const token = useSearchParams()[0].get('token');
  const heading = t(mode === 'verify' ? 'authFlow.verifyPageTitle' : mode === 'forgot' ? 'authPage.forgotTitle' : 'authFlow.resetTitle');
  return (
    <AuthShell
      title={heading}
      back="login"
      photo="recovery"
      sideTitle={t('authPage.recoverySideTitle')}
      side={<p>{t('authPage.recoverySideBody')}</p>}
    >
      {mode === 'forgot' ? <ForgotPassword /> : (
        <>
          <AuthHeading eyebrow={t('authPage.helpEyebrow')} title={heading} />
          {mode === 'verify' ? <VerifyEmail key={token ?? ''} /> : <ResetPassword key={token ?? ''} />}
        </>
      )}
    </AuthShell>
  );
}

function ResultAlert({ result }: { result: Exclude<TokenResult, 'ok'> }) {
  const { t } = useTranslation();
  return (
    <p className="alert alert--error" role="alert">
      {t(result === 'expired' ? 'authFlow.tokenExpired' : result === 'used' ? 'authFlow.tokenUsed' : 'authFlow.tokenInvalid')}
    </p>
  );
}

/* ---------------------------------------------------------------- Verify */

function VerifyEmail() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const [params] = useSearchParams();
  const token = params.get('token');
  const user = useAuthStore((s) => s.user);
  const [result, setResult] = useState<TokenResult | null>(null);
  const [demoToken, setDemoToken] = useState('');
  const [cooldown, setCooldown] = useState<string>();
  const remaining = useCountdown(cooldown);

  if (!user) {
    return (
      <>
        <p>{t('authFlow.loginFirst')}</p>
        <NavLink id="verify-login" className="auth-btn" to={path('/auth/login')} state={{ from: path(`/auth/verify-email${token ? `?token=${token}` : ''}`) }}>
          {t('common.login')}
        </NavLink>
      </>
    );
  }

  if (user.emailVerified) {
    return (
      <>
        <p className="alert alert--success" role="status">{t('authFlow.verifyDone')}</p>
        <NavLink id="verify-continue" className="auth-btn" to={path('/account')}>{t('authFlow.toAccount')}</NavLink>
      </>
    );
  }

  const resend = async () => {
    const res = await useAuthStore.getState().resendVerification();
    setDemoToken(res.devToken ?? '');
    setCooldown(res.retryAfterMs ? new Date(Date.now() + res.retryAfterMs).toISOString() : cooldownTarget());
    setResult(null);
  };

  // Konfirmasi lewat tombol (bukan otomatis saat halaman dibuka) agar pemindai tautan email
  // tidak memakai token sekali pakai sebelum pelanggan.
  const confirm = async () => setResult(await useAuthStore.getState().verifyEmail(token));

  const resendButton = (
    <button id="verify-resend" type="button" className="auth-btn auth-btn--outline" disabled={remaining > 0} onClick={resend}>
      {remaining > 0 ? t('authFlow.resendCooldown', { seconds: Math.ceil(remaining / 1000) }) : t('authFlow.resend')}
    </button>
  );

  return (
    <>
      <p className="text-muted">{t('authFlow.verifyPending', { email: user.email })}</p>
      {token && !result && (
        <button id="verify-confirm" type="button" className="auth-btn" onClick={confirm}>
          {t('authFlow.verifyConfirm')}
        </button>
      )}
      {result && result !== 'ok' && <ResultAlert result={result} />}
      {resendButton}
      {demoToken && (
        <p className="auth-note" role="status">
          <span>
            {t('authFlow.devNote')}{' '}
            <NavLink id="verify-demo-link" to={path(`/auth/verify-email?token=${demoToken}`)}>{t('authFlow.simulateVerifyLink')}</NavLink>
          </span>
        </p>
      )}
      <p className="field-hint">{t('authFlow.verifyWhy')}</p>
    </>
  );
}

/* ---------------------------------------------------------------- Forgot */

function ForgotPassword() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [demoToken, setDemoToken] = useState('');
  const [cooldown, setCooldown] = useState<string>();
  const remaining = useCountdown(cooldown);

  const send = async () => {
    // AC-01-06: the API answers the same way whether or not the email is registered.
    const res = await api<{ devToken?: string }>('/auth/forgot', { body: { email } });
    if (!res.ok) {
      setError(t(res.status === 0 ? 'authPage.networkError' : 'auth.invalidEmail'));
      return;
    }
    setDemoToken(res.data.devToken ?? '');
    setSent(true);
    setCooldown(cooldownTarget());
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError('');
    void send();
  };

  if (sent) {
    return (
      <>
        <span className="auth-badge" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7.5l8.5 6 8.5-6" /></svg>
        </span>
        <AuthHeading title={t('authPage.checkTitle')}>
          <span role="status">{t('authPage.checkBefore')} <strong>{email}</strong>{t('authPage.checkAfter', { minutes: AUTH_PARAMS.resetTokenTtlMin })}</span>
        </AuthHeading>
        <NavLink id="forgot-back-login" className="auth-btn" to={path('/auth/login')}>{t('authPage.backLogin')}</NavLink>
        <div className="auth-help">
          <p className="auth-help__title">{t('authPage.didntGet')}</p>
          <p>
            {t('authPage.spam')}{' '}
            <button id="forgot-resend" type="button" className="auth-link" disabled={remaining > 0} onClick={() => void send()}>
              {remaining > 0 ? t('authPage.sendAgainIn', { seconds: Math.ceil(remaining / 1000) }) : t('authPage.sendAgain')}
            </button>. {t('authPage.wrongEmail')}{' '}
            <button id="forgot-change-email" type="button" className="auth-link" onClick={() => setSent(false)}>{t('authPage.tryAnother')}</button>.
          </p>
        </div>
        {demoToken && <p className="auth-note">
          {t('authFlow.devNote')}{' '}
          <NavLink id="forgot-demo-link" to={path(`/auth/reset-password?token=${demoToken}`)}>{t('authFlow.simulateReset')}</NavLink>
        </p>}
      </>
    );
  }

  return (
    <>
      <AuthHeading eyebrow={t('authPage.helpEyebrow')} title={t('authPage.forgotTitle')}>{t('authPage.forgotBody')}</AuthHeading>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField id="forgot-email" label={t('auth.email')} type="email" required value={email} autoComplete="email" placeholder={t('authPage.emailPlaceholder')} error={error || undefined} onChange={(e) => setEmail(e.target.value)} />
        <button id="forgot-submit" type="submit" className="auth-btn">{t('authFlow.forgotSubmit')}</button>
      </form>
      <p className="auth-callout">
        <Icon name="whatsapp" size={20} />
        <span>{t('authPage.cantAccess')} <ChatLink id="forgot-chat" className="auth-link" message={{ id: t('authPage.chatMessage'), en: t('authPage.chatMessage') }}>{t('authPage.chat')}</ChatLink></span>
      </p>
    </>
  );
}

/* ---------------------------------------------------------------- Reset */

function strength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 12 && variety >= 3) return 3;
  return variety >= 2 ? 2 : 1;
}

function ResetPassword() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [failure, setFailure] = useState<Exclude<TokenResult, 'ok'> | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);

  // The link is checked when the page opens (AC-01-05), without using it up.
  useEffect(() => {
    let live = true;
    void api<{ result: TokenResult }>('/auth/reset/inspect', { body: { token: token ?? '' } }).then((res) => {
      if (!live) return;
      const result = res.ok ? res.data.result : 'invalid';
      if (result !== 'ok') setFailure(result);
      setChecked(true);
    });
    return () => { live = false; };
  }, [token]);
  const score = strength(password);

  if (done) {
    return (
      <>
        <p className="alert alert--success" role="status">{t('authFlow.resetDone')}</p>
        <NavLink id="reset-login" className="auth-btn" to={path('/auth/login')}>{t('common.login')}</NavLink>
      </>
    );
  }

  if (failure) {
    return (
      <>
        <ResultAlert result={failure} />
        <NavLink id="reset-request-new" className="auth-btn" to={path('/auth/forgot-password')}>{t('authFlow.requestNew')}</NavLink>
      </>
    );
  }

  if (!checked) return <p className="auth-note" role="status">{t('common.loading')}</p>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('auth.passwordMin'));
    if (password !== confirmation) return setError(t('authFlow.mismatch'));
    const res = await api<{ result: TokenResult }>('/auth/reset', { body: { token: token ?? '', password } });
    if (!res.ok) return setError(t(res.status === 0 ? 'authPage.networkError' : 'auth.passwordMin'));
    if (res.data.result !== 'ok') return setFailure(res.data.result);
    setPassword('');
    setConfirmation('');
    // The server ended every session; mirror that here.
    await useAuthStore.getState().refresh();
    setDone(true);
  };

  return (
    <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
      <PasswordField id="reset-password" label={t('authFlow.newPassword')} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div id="reset-strength" className="auth-strength" data-score={score} aria-live="polite">
        <span className="auth-strength__bar" aria-hidden="true"><span /><span /><span /></span>
        <span className="text-sm text-muted">{password ? t(`authFlow.strength.${score}`) : t('auth.passwordMin')}</span>
      </div>
      <PasswordField id="reset-confirm" label={t('authFlow.confirmPassword')} required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} error={confirmation && confirmation !== password ? t('authFlow.mismatch') : undefined} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button id="reset-submit" className="auth-btn" type="submit">{t('authFlow.resetSubmit')}</button>
    </form>
  );
}
