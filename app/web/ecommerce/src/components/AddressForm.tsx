import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Address } from '../types/domain';
import { COUNTRIES, getCountry } from '../utils/countries';
import { useLocale } from '../hooks/useLocale';
import CountryPicker from './CountryPicker';
import Required from './Required';
import { countryName, dialChoices } from '../utils/countryChoices';
import { validateAddress, type AddressDraft, type AddressErrors } from '../utils/address';
import { loadIdRegions, type IdRegions } from '../utils/idRegions';

/** A saved address may spell a name in another case ("JAWA BARAT"): the list's own spelling. */
const sameName = (names: string[], typed: string) => names.find((n) => n.toLowerCase() === typed.trim().toLowerCase());

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
 * Untuk Indonesia, provinsi, kota dan kode pos dipilih dari daftar yang saling mengikuti:
 * kota mengikuti provinsi, kode pos mengikuti kota. Negara lain tetap diketik.
 */
export default function AddressForm({ initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AddressDraft>(() => {
    if (!initial) return EMPTY;
    const { id: _id, ...rest } = initial;
    return { ...EMPTY, ...rest };
  });
  const [errors, setErrors] = useState<AddressErrors>({});
  const locale = useLocale();

  const country = getCountry(draft.country);
  const countryChoices = useMemo(() => COUNTRIES.map((c) => ({ value: c.name, iso: c.iso, label: countryName(c.iso, locale, c.name) })), [locale]);
  const dialOptions = useMemo(() => dialChoices(locale), [locale]);
  // Several countries share a calling code (+1), so the code alone cannot say which flag to show.
  const [dialIso, setDialIso] = useState(() => (country && country.dialCode === draft.phoneCountryCode ? country.iso : dialOptions.find((c) => c.hint === draft.phoneCountryCode)?.iso ?? ''));
  // The country being shipped to, then the ones the store serves, lead the list.
  const dialPinned = [...new Set([...(country ? [country.iso] : []), 'ID', 'SG', 'MY', 'US', 'AU'])];

  // Indonesia's provinces, cities and postal codes, fetched once an Indonesian address is being
  // filled in. Until they arrive (or if they cannot be had) the three fields are typed.
  const [idRegions, setIdRegions] = useState<IdRegions | null>(null);
  const isIndonesia = draft.country === 'Indonesia';
  useEffect(() => {
    if (!isIndonesia || idRegions) return;
    let cancelled = false;
    void loadIdRegions().then((data) => {
      if (cancelled || !data) return;
      setIdRegions(data);
      setDraft((d) => {
        const state = sameName(Object.keys(data), d.state);
        const city = state && sameName(Object.keys(data[state]), d.city);
        return { ...d, state: state ?? d.state, city: city ?? d.city, postalCode: d.postalCode.trim() };
      });
    });
    return () => { cancelled = true; };
  }, [isIndonesia, idRegions]);
  const regions = isIndonesia ? idRegions : null;
  const cities = regions?.[draft.state];
  const postalCodes = cities?.[draft.city];
  const stateChoices = useMemo(() => Object.keys(regions ?? {}).map((name) => ({ value: name, iso: '', label: name })), [regions]);
  const cityChoices = useMemo(() => Object.keys(cities ?? {}).map((name) => ({ value: name, iso: '', label: name })), [cities]);
  const postalChoices = useMemo(() => (postalCodes ?? []).map(([code, district]) => ({ value: code, iso: '', label: code, hint: district })), [postalCodes]);

  const update = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleCountry = (name: string) => {
    const c = getCountry(name);
    // Another country: its province, city and postal code are not the ones filled in so far.
    setDraft((d) => ({ ...d, country: name, phoneCountryCode: c?.dialCode ?? d.phoneCountryCode, ...(name !== d.country ? { state: '', city: '', postalCode: '' } : {}) }));
    if (c) setDialIso(c.iso); // most people's phone is from the country they live in; it can still be changed
    setErrors((e) => ({ ...e, country: undefined, phoneCountryCode: undefined, state: undefined, city: undefined, postalCode: undefined }));
  };

  // A city belongs to its province and a postal code to its city: choosing one clears what follows.
  const handleState = (name: string) => {
    setDraft((d) => (name === d.state ? d : { ...d, state: name, city: '', postalCode: '' }));
    setErrors((e) => ({ ...e, state: undefined, city: undefined, postalCode: undefined }));
  };
  const handleCity = (name: string) => {
    setDraft((d) => (name === d.city ? d : { ...d, city: name, postalCode: '' }));
    setErrors((e) => ({ ...e, city: undefined, postalCode: undefined }));
  };

  const handleDial = (iso: string) => {
    setDialIso(iso);
    update('phoneCountryCode', dialOptions.find((c) => c.iso === iso)?.hint ?? draft.phoneCountryCode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAddress(draft);
    // An address saved before the lists existed may hold a name or code that is not on them:
    // the dropdown then shows nothing chosen, and it has to be chosen.
    if (regions) {
      if (!cities) next.state ??= 'address.errors.required';
      else if (!postalCodes) next.city ??= 'address.errors.required';
      else if (!postalCodes.some(([code]) => code === draft.postalCode)) next.postalCode ??= 'address.errors.postal';
    }
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
    'aria-required': key !== 'postalCode' || !country?.postalOptional,
    'aria-describedby': errors[key] ? `addr-${key}-error` : undefined,
  });

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <p className="field-required-note"><Required /> {t('common.requiredNote')}</p>
      <label className="field" htmlFor="addr-recipient">
        <span>{t('address.recipient')}<Required /></span>
        <input
          {...fieldProps('recipient')}
          value={draft.recipient}
          onChange={(e) => update('recipient', e.target.value)}
          autoComplete="name"
        />
        {err('recipient')}
      </label>

      {/* Not a <label>: a click on a row of the list would otherwise be passed on to the button. */}
      <div className="field">
        <span id="addr-country-label">{t('address.country')}<Required /></span>
        <CountryPicker
          id="addr-country" labelledBy="addr-country-label" describedBy={errors.country ? 'addr-country-error' : 'addr-country-hint'} invalid={!!errors.country}
          choices={countryChoices} value={draft.country} onChange={handleCountry}
          placeholder={t('address.selectCountry')} searchLabel={t('address.searchCountry')} emptyLabel={t('address.noCountry')}
        />
        <span className="field-hint" id="addr-country-hint">{t('address.countryNote')}</span>
        {err('country')}
      </div>

      <div className="form-row form-row--phone">
        <div className="field">
          <span id="addr-phoneCountryCode-label">{t('address.dialCode')}<Required /></span>
          <CountryPicker
            id="addr-phoneCountryCode" labelledBy="addr-phoneCountryCode-label" describedBy={errors.phoneCountryCode ? 'addr-phoneCountryCode-error' : undefined} invalid={!!errors.phoneCountryCode}
            choices={dialOptions} pinned={dialPinned} value={dialIso} onChange={handleDial} compact
            placeholder={draft.phoneCountryCode || '+62'} searchLabel={t('address.searchCode')} emptyLabel={t('address.noCountry')}
          />
          {err('phoneCountryCode')}
        </div>
        <label className="field" htmlFor="addr-phone">
          <span>{t('address.phone')}<Required /></span>
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

      {regions ? (
        <>
          {/* Not <label>s, for the same reason as the country above. */}
          <div className="form-row">
            <div className="field">
              <span id="addr-state-label">{t('address.state')}<Required /></span>
              <CountryPicker
                id="addr-state" labelledBy="addr-state-label" describedBy={errors.state ? 'addr-state-error' : undefined} invalid={!!errors.state}
                choices={stateChoices} value={draft.state} onChange={handleState}
                placeholder={t('address.selectState')} searchLabel={t('address.searchState')} emptyLabel={t('address.noMatch')}
              />
              {err('state')}
            </div>
            <div className="field">
              <span id="addr-city-label">{t('address.city')}<Required /></span>
              <CountryPicker
                id="addr-city" labelledBy="addr-city-label" describedBy={errors.city ? 'addr-city-error' : undefined} invalid={!!errors.city}
                choices={cityChoices} value={draft.city} onChange={handleCity} disabled={!cities}
                placeholder={t(cities ? 'address.selectCity' : 'address.stateFirst')} searchLabel={t('address.searchCity')} emptyLabel={t('address.noMatch')}
              />
              {err('city')}
            </div>
          </div>
          <div className="field">
            <span id="addr-postalCode-label">{t('address.postalCode')}<Required /></span>
            <CountryPicker
              id="addr-postalCode" labelledBy="addr-postalCode-label" describedBy={errors.postalCode ? 'addr-postalCode-error' : undefined} invalid={!!errors.postalCode}
              choices={postalChoices} value={draft.postalCode} onChange={(code) => update('postalCode', code)} disabled={!postalCodes}
              placeholder={t(postalCodes ? 'address.selectPostal' : 'address.cityFirst')} searchLabel={t('address.searchPostal')} emptyLabel={t('address.noMatch')}
            />
            {err('postalCode')}
          </div>
        </>
      ) : (
        <>
          <div className="form-row">
            <label className="field" htmlFor="addr-state">
              <span>{t('address.state')}<Required /></span>
              <input
                {...fieldProps('state')}
                value={draft.state}
                onChange={(e) => update('state', e.target.value)}
                autoComplete="address-level1"
              />
              {err('state')}
            </label>
            <label className="field" htmlFor="addr-city">
              <span>{t('address.city')}<Required /></span>
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
            <span>{country?.postalOptional ? t('address.postalOptional') : <>{t('address.postalCode')}<Required /></>}</span>
            <input
              {...fieldProps('postalCode')}
              value={draft.postalCode}
              onChange={(e) => update('postalCode', e.target.value)}
              autoComplete="postal-code"
            />
            {err('postalCode')}
          </label>
        </>
      )}

      <label className="field" htmlFor="addr-line1">
        <span>{t('address.line1')}<Required /></span>
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
