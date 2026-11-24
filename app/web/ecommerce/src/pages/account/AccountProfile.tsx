import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';
import type { Currency } from '../../types/domain';

/**
 * F-02 Profil & Preferensi (FR-02-01): username, email, telepon berkode negara,
 * bahasa, mata uang, dan status newsletter.
 */
export default function AccountProfile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuthStore();
  const { currency, setCurrency, isUsdAvailable } = usePreferenceStore();

  const [form, setForm] = useState({
    username: user?.username ?? '',
    phoneCountryCode: user?.phoneCountryCode ?? '+62',
    phone: user?.phone ?? '',
    newsletter: user?.newsletter ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.username.trim().length < 3) next.username = t('auth.usernameMin');
    if (form.phone) {
      if (!/^\+\d{1,4}$/.test(form.phoneCountryCode.trim())) next.phoneCountryCode = t('address.errors.dialCode');
      if (!/^\d{6,15}$/.test(form.phone.replace(/[\s-]/g, ''))) next.phone = t('address.errors.phone');
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    updateProfile({
      username: form.username.trim(),
      phoneCountryCode: form.phoneCountryCode.trim(),
      phone: form.phone.trim() || undefined,
      newsletter: form.newsletter,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      {!user.emailVerified && <EmailVerifyNotice />}

      <div className="card account-panel">
        <div className="account-panel__head">
          <h2>{t('account.profile')}</h2>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <label className="field" htmlFor="profile-email">
              {t('auth.email')}
              <input id="profile-email" value={user.email} disabled />
              <span className="field-hint">
                {t('account.loginMethod')}: {user.provider === 'google' ? 'Google' : 'Email'}
              </span>
            </label>
            <label className="field" htmlFor="profile-username">
              {t('auth.username')}
              <input
                id="profile-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                aria-invalid={!!errors.username}
              />
              {errors.username && <span className="field-error">{errors.username}</span>}
            </label>
          </div>

          <div className="form-row form-row--phone">
            <label className="field" htmlFor="profile-dial">
              {t('address.dialCode')}
              <input
                id="profile-dial"
                value={form.phoneCountryCode}
                onChange={(e) => setForm({ ...form, phoneCountryCode: e.target.value })}
                aria-invalid={!!errors.phoneCountryCode}
                inputMode="tel"
              />
              {errors.phoneCountryCode && <span className="field-error">{errors.phoneCountryCode}</span>}
            </label>
            <label className="field" htmlFor="profile-phone">
              {t('address.phone')}
              <input
                id="profile-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                aria-invalid={!!errors.phone}
                inputMode="tel"
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </label>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={form.newsletter}
              onChange={(e) => setForm({ ...form, newsletter: e.target.checked })}
            />
            {t('account.newsletter')}
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', justifyContent: 'flex-end' }}>
            {saved && (
              <span className="text-sm" style={{ color: 'var(--c-success)' }} role="status">
                ✓ {t('account.profileSaved')}
              </span>
            )}
            <button type="submit" className="btn btn--primary" id="profile-save">
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>

      <div className="card account-panel">
        <div className="account-panel__head">
          <h2>{t('account.preferences')}</h2>
        </div>
        <div className="form-row">
          <label className="field" htmlFor="pref-currency">
            {t('account.currency')}
            <select
              id="pref-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              <option value="IDR">IDR — Rupiah</option>
              <option value="USD" disabled={!isUsdAvailable()}>
                USD — US Dollar
              </option>
            </select>
          </label>
        </div>
      </div>
    </>
  );
}
