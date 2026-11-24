import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';
import type { Currency } from '../../types/domain';

/**
 * F-02 Profile & preferences (FR-02-01): name, email, phone with country code,
 * display currency and newsletter consent.
 */
export default function AccountProfile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuthStore();
  const { currency, setCurrency, isUsdAvailable } = usePreferenceStore();

  const [form, setForm] = useState({
    username: user?.username ?? '',
    phoneCountryCode: user?.phoneCountryCode ?? '+62',
    phone: user?.phone ?? '',
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
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const usdReady = isUsdAvailable();
  const currencies: { value: Currency; label: string; disabled?: boolean }[] = [
    { value: 'IDR', label: t('acct.idr') },
    { value: 'USD', label: t('acct.usd'), disabled: !usdReady },
  ];

  return (
    <>
      <header className="acct-title">
        <div><h2>{t('account.profile')}</h2></div>
      </header>

      {!user.emailVerified && <EmailVerifyNotice />}

      <section className="acct-card" aria-labelledby="profile-personal-title">
        <h3 id="profile-personal-title" className="acct-label acct-label--ink">{t('acct.personal')}</h3>
        <form className="acct-form" onSubmit={handleSubmit} noValidate>
          <div className="acct-form__row">
            <div className="acct-field">
              <label htmlFor="profile-username">{t('acct.fullName')}</label>
              <input id="profile-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} aria-invalid={!!errors.username} autoComplete="name" maxLength={80} />
              {errors.username && <p className="acct-field__error">{errors.username}</p>}
            </div>
            <div className="acct-field">
              <label htmlFor="profile-email">{t('auth.email')}</label>
              <input id="profile-email" value={user.email} disabled />
              <p>{t('acct.signedInWith', { provider: user.provider === 'google' ? 'Google' : t('auth.email') })} · {t(user.emailVerified ? 'acct.verified' : 'acct.notVerified')}</p>
            </div>
          </div>

          <div className="acct-field">
            <label htmlFor="profile-phone">{t('address.phone')}</label>
            <div className="acct-form__phone">
              <input id="profile-dial" value={form.phoneCountryCode} onChange={(e) => setForm({ ...form, phoneCountryCode: e.target.value })} aria-label={t('address.dialCode')} aria-invalid={!!errors.phoneCountryCode} inputMode="tel" maxLength={5} />
              <input id="profile-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors.phone} inputMode="tel" autoComplete="tel-national" placeholder="812 3456 7890" maxLength={20} />
            </div>
            {(errors.phoneCountryCode || errors.phone)
              ? <p className="acct-field__error">{errors.phoneCountryCode || errors.phone}</p>
              : <p>{t('acct.phoneHint')}</p>}
          </div>

          <div className="acct-form__foot">
            {saved && <span role="status"><span aria-hidden="true">✓ </span>{t('account.profileSaved')}</span>}
            <button type="submit" className="guide-btn" id="profile-save">{t('acct.saveChanges')}</button>
          </div>
        </form>
      </section>

      <section className="acct-card" aria-labelledby="profile-shopping-title">
        <h3 id="profile-shopping-title" className="acct-label acct-label--ink">{t('acct.shopping')}</h3>
        <fieldset className="acct-radios">
          <legend>{t('acct.displayPrices')}</legend>
          {currencies.map((c) => (
            <label key={c.value} className={currency === c.value ? 'is-checked' : ''}>
              <input id={`pref-currency-${c.value}`} type="radio" name="pref-currency" value={c.value} checked={currency === c.value} disabled={c.disabled} onChange={() => setCurrency(c.value)} />
              {c.label}
            </label>
          ))}
        </fieldset>
        <p className="acct-hint">{usdReady ? t('acct.currencyHint') : t('acct.usdUnavailable')}</p>
      </section>

      <section className="acct-card" aria-labelledby="profile-email-title">
        <h3 id="profile-email-title" className="acct-label acct-label--ink">{t('acct.emailPrefs')}</h3>
        <label className="acct-check">
          <input id="profile-newsletter" type="checkbox" checked={user.newsletter} onChange={(e) => updateProfile({ newsletter: e.target.checked })} />
          <span>{t('acct.newsletterLong')}</span>
        </label>
      </section>
    </>
  );
}
