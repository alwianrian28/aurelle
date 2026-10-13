import { useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../../hooks/useLocale';
import { useAuthStore } from '../../store/authStore';
import { useCountdown } from '../../hooks/useCountdown';
import { AUTH_PARAMS } from '../../config/auth';
import { consumeToken, inspectToken, issueToken, type TokenResult } from '../../utils/demoToken';
import './Auth.css';

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
  const heading = t(mode === 'verify' ? 'authFlow.verifyPageTitle' : mode === 'forgot' ? 'authFlow.forgotTitle' : 'authFlow.resetTitle');
  return (
    <div className="auth-page container">
      <section className="auth-card card">
        <title>{`${heading} — Aurelle`}</title>
        <meta name="robots" content="noindex" />
        <meta name="description" content={heading} />
        <p className="eyebrow">Aurelle</p>
        <h1 className="heading-lg">{heading}</h1>
        <p className="alert alert--info">{t('authFlow.demoNote')}</p>
        {mode === 'verify' && <VerifyEmail key={token ?? ''} />}
        {mode === 'forgot' && <ForgotPassword />}
        {mode === 'reset' && <ResetPassword key={token ?? ''} />}
        <BackToLogin />
      </section>
    </div>
  );
}

function BackToLogin() {
  const { t } = useTranslation();
  const path = useLocalePath();
  return (
    <div className="auth-links">
      <NavLink id="recovery-login" to={path('/auth/login')}>{t('authFlow.backToLogin')}</NavLink>
    </div>
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
        <NavLink id="verify-login" className="btn btn--primary btn--block" to={path('/auth/login')} state={{ from: path(`/auth/verify-email${token ? `?token=${token}` : ''}`) }}>
          {t('common.login')}
        </NavLink>
      </>
    );
  }

  if (user.emailVerified) {
    return (
      <>
        <p className="alert alert--success" role="status">{t('authFlow.verifyDone')}</p>
        <NavLink id="verify-continue" className="btn btn--primary btn--block" to={path('/account')}>{t('authFlow.toAccount')}</NavLink>
      </>
    );
  }

  const resend = () => {
    setDemoToken(issueToken('verify', user.email, AUTH_PARAMS.verifyTokenTtlMin));
    setCooldown(cooldownTarget());
    setResult(null);
  };

  // Konfirmasi lewat tombol (bukan otomatis saat halaman dibuka) agar pemindai tautan email
  // tidak memakai token sekali pakai sebelum pelanggan.
  const confirm = () => {
    const check = consumeToken('verify', token);
    if (check.result === 'ok' && check.email !== user.email.trim().toLowerCase()) {
      setResult('invalid');
      return;
    }
    setResult(check.result);
    if (check.result === 'ok') useAuthStore.getState().verifyEmail();
  };

  const resendButton = (
    <button id="verify-resend" type="button" className="btn btn--outline btn--block" disabled={remaining > 0} onClick={resend}>
      {remaining > 0 ? t('authFlow.resendCooldown', { seconds: Math.ceil(remaining / 1000) }) : t('authFlow.resend')}
    </button>
  );

  return (
    <>
      <p className="text-muted">{t('authFlow.verifyPending', { email: user.email })}</p>
      {token && !result && (
        <button id="verify-confirm" type="button" className="btn btn--primary btn--block" onClick={confirm}>
          {t('authFlow.verifyConfirm')}
        </button>
      )}
      {result && result !== 'ok' && <ResultAlert result={result} />}
      {resendButton}
      {demoToken && (
        <p className="alert alert--info" role="status">
          <span>
            {t('authFlow.demoResent')}{' '}
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (remaining > 0) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError('');
    // AC-01-06: respons identik untuk email terdaftar maupun tidak.
    setDemoToken(issueToken('reset', email, AUTH_PARAMS.resetTokenTtlMin));
    setSent(true);
    setCooldown(cooldownTarget());
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <p className="text-muted">{t('authFlow.forgotIntro')}</p>
      <label>
        {t('auth.email')}
        <input id="forgot-email" type="email" required value={email} autoComplete="email" aria-invalid={!!error} onChange={(e) => setEmail(e.target.value)} />
        {error && <span className="auth-field-error" role="alert">{error}</span>}
      </label>
      <button id="forgot-submit" type="submit" className="btn btn--primary btn--block" disabled={remaining > 0}>
        {remaining > 0 ? t('authFlow.resendCooldown', { seconds: Math.ceil(remaining / 1000) }) : sent ? t('authFlow.resend') : t('authFlow.forgotSubmit')}
      </button>
      {sent && (
        <>
          <p className="alert alert--success" role="status">{t('authFlow.forgotSent')}</p>
          <p className="alert alert--info">
            <span>
              {t('authFlow.demoResetLink', { minutes: AUTH_PARAMS.resetTokenTtlMin })}{' '}
              <NavLink id="forgot-demo-link" to={path(`/auth/reset-password?token=${demoToken}`)}>{t('authFlow.simulateReset')}</NavLink>
            </span>
          </p>
        </>
      )}
    </form>
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
  // Token diperiksa saat halaman dibuka (AC-01-05) — tanpa memakainya.
  const [initial] = useState(() => inspectToken('reset', token).result);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [failure, setFailure] = useState<Exclude<TokenResult, 'ok'> | null>(initial === 'ok' ? null : initial);
  const [done, setDone] = useState(false);
  const score = strength(password);

  if (done) {
    return (
      <>
        <p className="alert alert--success" role="status">{t('authFlow.resetDone')}</p>
        <p className="field-hint">{t('authFlow.demoResetDone')}</p>
        <NavLink id="reset-login" className="btn btn--primary btn--block" to={path('/auth/login')}>{t('common.login')}</NavLink>
      </>
    );
  }

  if (failure) {
    return (
      <>
        <ResultAlert result={failure} />
        <NavLink id="reset-request-new" className="btn btn--primary btn--block" to={path('/auth/forgot-password')}>{t('authFlow.requestNew')}</NavLink>
      </>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('auth.passwordMin'));
    if (password !== confirmation) return setError(t('authFlow.mismatch'));
    const check = consumeToken('reset', token);
    if (check.result !== 'ok') return setFailure(check.result);
    setPassword('');
    setConfirmation('');
    // Semua sesi diakhiri setelah reset (keamanan §15).
    useAuthStore.getState().logout();
    setDone(true);
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <label>
        {t('authFlow.newPassword')}
        <input id="reset-password" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="reset-strength" />
      </label>
      <div id="reset-strength" className="auth-strength" data-score={score} aria-live="polite">
        <span className="auth-strength__bar" aria-hidden="true"><span /><span /><span /></span>
        <span className="text-sm text-muted">{password ? t(`authFlow.strength.${score}`) : t('auth.passwordMin')}</span>
      </div>
      <label>
        {t('authFlow.confirmPassword')}
        <input id="reset-confirm" type={show ? 'text' : 'password'} required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} aria-invalid={!!confirmation && confirmation !== password} />
      </label>
      <label className="check">
        <input id="reset-show" type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span>{t('authFlow.showPassword')}</span>
      </label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button id="reset-submit" className="btn btn--primary btn--block" type="submit">{t('authFlow.resetSubmit')}</button>
    </form>
  );
}
