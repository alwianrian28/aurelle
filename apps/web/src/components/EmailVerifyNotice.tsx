import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useLocalePath } from '../hooks/useLocale';
import { useCountdown } from '../hooks/useCountdown';
import { AUTH_PARAMS } from '../config/auth';
import { issueToken } from '../utils/demoToken';

/**
 * Pemberitahuan email belum terverifikasi (FR-01-03, AC-01-03) + opsi kirim ulang dengan jeda.
 * Mode demo: belum ada layanan email, jadi tautan verifikasi sekali pakai ditampilkan langsung.
 */
export default function EmailVerifyNotice() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const user = useAuthStore((s) => s.user);
  const [token, setToken] = useState('');
  const [cooldown, setCooldown] = useState<string>();
  const remaining = useCountdown(cooldown);

  if (!user || user.emailVerified) return null;

  const resend = () => {
    setToken(issueToken('verify', user.email, AUTH_PARAMS.verifyTokenTtlMin));
    setCooldown(new Date(Date.now() + AUTH_PARAMS.resendCooldownSec * 1000).toISOString());
  };

  return (
    <div className="alert alert--warning" role="status">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span>{t('account.emailUnverified')}</span>
        <span style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button type="button" className="link" onClick={resend} disabled={remaining > 0} id="resend-verification">
            {remaining > 0
              ? t('authFlow.resendCooldown', { seconds: Math.ceil(remaining / 1000) })
              : t('account.resendVerification')}
          </button>
          {token && (
            <NavLink id="simulate-verify" to={path(`/auth/verify-email?token=${token}`)}>
              {t('authFlow.simulateVerifyLink')}
            </NavLink>
          )}
          <NavLink id="verify-status" to={path('/auth/verify-email')}>{t('authFlow.verifyPageTitle')}</NavLink>
        </span>
      </div>
    </div>
  );
}
