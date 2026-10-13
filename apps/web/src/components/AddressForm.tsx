import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Address } from '../types/domain';
import { COUNTRIES, getCountry } from '../utils/countries';
import { validateAddress, type AddressDraft, type AddressErrors } from '../utils/address';

const EMPTY: AddressDraft = {
  recipient: '',
  phoneCountryCode: '+62',
  phone: '',
  country: '',
  state: '',
  city: '',
  postalCode: '',
  line1: '',
  line2: '',
  isDefault: false,
};

interface Props {
  initial?: Address;
  onSubmit: (draft: AddressDraft) => void;
  onCancel: () => void;
}

/**
 * Form alamat internasional (F-02, FR-02-02).
 * Validasi per field; telepon wajib berkode negara (AC-02-03).
 */
export default function AddressForm({ initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AddressDraft>(() => {
    if (!initial) return EMPTY;
    const { id: _id, ...rest } = initial;
    return { ...EMPTY, ...rest };
  });
  const [errors, setErrors] = useState<AddressErrors>({});

  const country = getCountry(draft.country);

  const update = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleCountry = (name: string) => {
    const c = getCountry(name);
    setDraft((d) => ({ ...d, country: name, phoneCountryCode: c?.dialCode ?? d.phoneCountryCode }));
    setErrors((e) => ({ ...e, country: undefined, phoneCountryCode: undefined, postalCode: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAddress(draft);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ ...draft, line2: draft.line2?.trim() || undefined });
  };

  const err = (key: keyof AddressDraft) =>
    errors[key] ? (
      <span className="field-error" id={`addr-${key}-error`}>
        {t(errors[key]!)}
      </span>
    ) : null;

  const fieldProps = (key: keyof AddressDraft) => ({
    id: `addr-${key}`,
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `addr-${key}-error` : undefined,
  });

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <label className="field" htmlFor="addr-recipient">
        {t('address.recipient')}
        <input
          {...fieldProps('recipient')}
          value={draft.recipient}
          onChange={(e) => update('recipient', e.target.value)}
          autoComplete="name"
        />
        {err('recipient')}
      </label>

      <label className="field" htmlFor="addr-country">
        {t('address.country')}
        <select {...fieldProps('country')} value={draft.country} onChange={(e) => handleCountry(e.target.value)}>
          <option value="">{t('address.selectCountry')}</option>
          {COUNTRIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="field-hint">{t('address.countryNote')}</span>
        {err('country')}
      </label>

      <div className="form-row form-row--phone">
        <label className="field" htmlFor="addr-phoneCountryCode">
          {t('address.dialCode')}
          <input
            {...fieldProps('phoneCountryCode')}
            value={draft.phoneCountryCode}
            onChange={(e) => update('phoneCountryCode', e.target.value)}
            inputMode="tel"
            placeholder="+62"
          />
          {err('phoneCountryCode')}
        </label>
        <label className="field" htmlFor="addr-phone">
          {t('address.phone')}
          <input
            {...fieldProps('phone')}
            value={draft.phone}
            onChange={(e) => update('phone', e.target.value)}
            inputMode="tel"
            autoComplete="tel-national"
          />
          {err('phone')}
        </label>
      </div>

      <div className="form-row">
        <label className="field" htmlFor="addr-state">
          {t('address.state')}
          <input
            {...fieldProps('state')}
            value={draft.state}
            onChange={(e) => update('state', e.target.value)}
            autoComplete="address-level1"
          />
          {err('state')}
        </label>
        <label className="field" htmlFor="addr-city">
          {t('address.city')}
          <input
            {...fieldProps('city')}
            value={draft.city}
            onChange={(e) => update('city', e.target.value)}
            autoComplete="address-level2"
          />
          {err('city')}
        </label>
      </div>

      <label className="field" htmlFor="addr-postalCode">
        {country?.postalOptional ? t('address.postalOptional') : t('address.postalCode')}
        <input
          {...fieldProps('postalCode')}
          value={draft.postalCode}
          onChange={(e) => update('postalCode', e.target.value)}
          autoComplete="postal-code"
        />
        {err('postalCode')}
      </label>

      <label className="field" htmlFor="addr-line1">
        {t('address.line1')}
        <input
          {...fieldProps('line1')}
          value={draft.line1}
          onChange={(e) => update('line1', e.target.value)}
          autoComplete="address-line1"
        />
        {err('line1')}
      </label>

      <label className="field" htmlFor="addr-line2">
        {t('address.line2')}
        <input
          id="addr-line2"
          value={draft.line2 ?? ''}
          onChange={(e) => update('line2', e.target.value)}
          autoComplete="address-line2"
        />
      </label>

      <label className="check">
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => update('isDefault', e.target.checked)} />
        {t('address.makeDefault')}
      </label>

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn--primary" id="address-save">
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
