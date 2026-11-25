import { getCountries, getCountryCallingCode } from 'libphonenumber-js/min';

/** A country in a picker: its flag (ISO code), what the list shows, and an extra like "+62". */
export interface CountryChoice {
  /** What the form stores for this choice. */
  value: string;
  iso: string;
  label: string;
  hint?: string;
}

// Every flag is a small file of its own, fetched only when a row with it is drawn.
const FLAGS = import.meta.glob('../../node_modules/country-flag-icons/3x2/*.svg', { eager: true, query: '?url&no-inline', import: 'default' }) as Record<string, string>;
export const flagUrl = (iso: string) => FLAGS[`../../node_modules/country-flag-icons/3x2/${iso}.svg`];

/** A country's name in the storefront's language ("Jerman", "Germany"). */
export function countryName(iso: string, locale: string, fallback = iso): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Every country that has a calling code, by name, for the phone number's country code. */
export function dialChoices(locale: string): CountryChoice[] {
  return getCountries()
    .filter((iso) => flagUrl(iso))
    .map((iso) => ({ value: iso, iso, label: countryName(iso, locale), hint: `+${getCountryCallingCode(iso)}` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
