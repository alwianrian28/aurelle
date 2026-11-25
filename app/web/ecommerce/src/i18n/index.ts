import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { id } from './locales/id';
import { usePreferenceStore } from '../store/preferenceStore';
import type { Locale } from '../types/domain';

/**
 * i18n setup. The storefront speaks American English and Indonesian.
 * A first visit is in English; the visitor can switch from the navigation bar at any time,
 * signed in or not, and the choice is remembered on this browser. The language also decides
 * how money is shown: English shows US dollars, Indonesian shows rupiah.
 */
export const LANGUAGES: { code: Locale; short: string; label: string }[] = [
  { code: 'en', short: 'EN', label: 'English (US)' },
  { code: 'id', short: 'ID', label: 'Bahasa Indonesia' },
];
const STORAGE_KEY = 'aurelle_language';
const currencyOf = (code: Locale) => (code === 'id' ? 'IDR' : 'USD');

function remembered(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'id' ? stored : null;
  } catch {
    return null; // storage unavailable (private mode): the choice lasts for this visit only
  }
}

const chosen = remembered();
void i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
    },
    lng: chosen ?? 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'id'],
    interpolation: { escapeValue: false },
  });
// A visitor who has never chosen a language gets the currency that goes with the default one.
if (!chosen) usePreferenceStore.getState().setCurrency(currencyOf('en'));

/** Switch the storefront's language, and the currency that goes with it. */
export function setLanguage(code: Locale): void {
  void i18next.changeLanguage(code);
  usePreferenceStore.getState().setCurrency(currencyOf(code));
  try { window.localStorage.setItem(STORAGE_KEY, code); } catch { /* not remembered; still switched */ }
}

export default i18next;
