import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { create } from 'zustand';
import { en } from './locales/en';
import { id } from './locales/id';
import { usePreferenceStore } from '../store/preferenceStore';
import type { I18nText, Locale } from '../types/domain';

/**
 * i18n setup. The storefront speaks English, Indonesian, Chinese, Korean and Japanese.
 *
 * - The visitor switches from the navigation bar at any time, signed in or not; the choice is
 *   remembered on this browser. A first visit opens in the store's default language.
 * - The language changes the words and nothing else: prices are shown in rupiah, and every
 *   payment method is offered, whatever the language.
 * - English and Indonesian are part of the page. The other three are fetched when chosen: each
 *   is a dictionary for the interface (locales/) and one for the store's own writing
 *   (content/), which exists in English and Indonesian only and is looked up by its English
 *   text. Anything a dictionary does not have is shown in English.
 * - Which of the five are offered, and the default, are store settings (dashboard > Settings),
 *   delivered with the catalog (`applyStoreLanguages`).
 */
export const LANGUAGES: { code: Locale; short: string; label: string; intl: string; html: string }[] = [
  { code: 'en', short: 'EN', label: 'English', intl: 'en-US', html: 'en' },
  { code: 'id', short: 'ID', label: 'Bahasa Indonesia', intl: 'id-ID', html: 'id' },
  { code: 'zh', short: '中文', label: '简体中文', intl: 'zh-CN', html: 'zh-Hans' },
  { code: 'ko', short: '한국어', label: '한국어', intl: 'ko-KR', html: 'ko' },
  { code: 'ja', short: '日本語', label: '日本語', intl: 'ja-JP', html: 'ja' },
];
const CODES = LANGUAGES.map((l) => l.code);
const isLocale = (value: unknown): value is Locale => CODES.includes(value as Locale);
const STORAGE_KEY = 'aurelle_language';

/** The locale to give `Intl` and `toLocaleString` for a storefront language. */
export const intlLocale = (code: Locale): string => LANGUAGES.find((l) => l.code === code)?.intl ?? 'en-US';
/** The value of `<html lang>` for a storefront language. */
export const htmlLang = (code: Locale): string => LANGUAGES.find((l) => l.code === code)?.html ?? 'en';
/** Any language tag (i18next's, the browser's) as one of the storefront's five. */
export const toLocale = (tag: string | undefined): Locale => CODES.find((code) => tag?.toLowerCase().startsWith(code)) ?? 'en';

/* ------------------------------------------------- fetched dictionaries */

type Loaded = { ui: Record<string, unknown>; content: Record<string, string> };
// The home page's copy is one small file for the three languages; it joins whichever is loaded.
const home = async (code: 'zh' | 'ko' | 'ja') => (await import('./content/home')).homeContent(code);
const LOADERS: Partial<Record<Locale, () => Promise<Loaded>>> = {
  zh: async () => ({ ui: (await import('./locales/zh')).zh, content: { ...(await import('./content/zh')).zhContent, ...(await home('zh')) } }),
  ko: async () => ({ ui: (await import('./locales/ko')).ko, content: { ...(await import('./content/ko')).koContent, ...(await home('ko')) } }),
  ja: async () => ({ ui: (await import('./locales/ja')).ja, content: { ...(await import('./content/ja')).jaContent, ...(await home('ja')) } }),
};
const CONTENT: Partial<Record<Locale, Record<string, string>>> = {};
const loading: Partial<Record<Locale, Promise<boolean>>> = {};

/** Fetch a language's dictionaries (once). False when they cannot be had: offline, mostly. */
function load(code: Locale): Promise<boolean> {
  const loader = LOADERS[code];
  if (!loader) return Promise.resolve(true);
  loading[code] ??= loader()
    .then(({ ui, content }) => {
      i18next.addResourceBundle(code, 'translation', ui, true, true);
      CONTENT[code] = content;
      return true;
    })
    .catch(() => { delete loading[code]; return false; });
  return loading[code]!;
}

/**
 * The store's own writing (a product name, a policy, a shipping service) in a language. It is
 * written in English and Indonesian; the other languages look the English text up in their
 * content dictionary and show the English when it is not there.
 */
export function localizeText(text: I18nText | undefined, code: Locale): string {
  if (!text) return '';
  if (code === 'id') return text.id || text.en;
  return CONTENT[code]?.[text.en] ?? text.en;
}

/* ------------------------------------------------------------- start-up */

function remembered(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
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
    // A fetched language takes over once its dictionary has arrived (`languageReady`).
    lng: chosen && !LOADERS[chosen] ? chosen : 'en',
    fallbackLng: 'en',
    supportedLngs: CODES,
    interpolation: { escapeValue: false },
  });
// Prices are shown in rupiah in every language. A browser that still remembers US dollars
// from when English showed them is put back.
usePreferenceStore.getState().setCurrency('IDR');

async function show(code: Locale): Promise<void> {
  if (await load(code)) await i18next.changeLanguage(code);
}

/** Settles once the remembered language is on screen; the first paint waits for it. */
export const languageReady: Promise<void> = chosen && LOADERS[chosen] ? show(chosen) : Promise.resolve();

/** Switch the storefront's language. Only the language: currency and payment methods stay as they are. */
export function setLanguage(code: Locale): void {
  void show(code);
  try { window.localStorage.setItem(STORAGE_KEY, code); } catch { /* not remembered; still switched */ }
}

/* ------------------------------------------------------- store settings */

const useOffered = create<{ codes: Locale[] }>(() => ({ codes: CODES }));

/** The languages the store offers, in the order the switch lists them. */
export function useLanguages() {
  const codes = useOffered((s) => s.codes);
  return LANGUAGES.filter((l) => codes.includes(l.code));
}

/**
 * What the store's settings say: which languages are offered, and which one a first visit
 * opens in. A visitor who has not chosen gets the default; one whose language is no longer
 * offered gets it too.
 */
export function applyStoreLanguages(codes: unknown, fallback: unknown): void {
  const offered = Array.isArray(codes) ? CODES.filter((code) => codes.includes(code)) : [];
  if (offered.length === 0) return;
  useOffered.setState({ codes: offered });
  const first = isLocale(fallback) && offered.includes(fallback) ? fallback : offered[0];
  const current = toLocale(i18next.language);
  if ((!remembered() && current !== first) || !offered.includes(current)) void show(first);
}

export default i18next;
