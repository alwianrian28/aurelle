import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentLocale, I18nText, Locale } from '../types/domain';
import { intlLocale, localizeText, toLocale } from '../i18n';
import { usePreferenceStore } from '../store/preferenceStore';
import { formatPriceFromIdr } from '../utils/currency';

/** The storefront's language now: one of the five it speaks. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return toLocale(i18n.language);
}

/** The language to show the store's own two-language writing in: Indonesian, or English for every other language. */
export function useContentLocale(): ContentLocale {
  return useLocale() === 'id' ? 'id' : 'en';
}

/** The locale to hand `Intl` and `toLocaleString` (dates, numbers) in the storefront's language. */
export function useIntlLocale(): string {
  return intlLocale(useLocale());
}

/** The store's own writing in the storefront's language (see `localizeText`). */
export function useLocalized() {
  const locale = useLocale();
  return useCallback((text: I18nText | undefined) => localizeText(text, locale), [locale]);
}

/** Format harga basis IDR ke mata uang aktif (BR-08). */
export function usePrice() {
  const locale = useLocale();
  const currency = usePreferenceStore((s) => s.currency);
  const usdToIdr = usePreferenceStore((s) => s.usdToIdr);
  return useCallback(
    (priceIdr: number) => formatPriceFromIdr(priceIdr, currency, usdToIdr, locale),
    [currency, usdToIdr, locale],
  );
}

/** Build a canonical URL without a language prefix. */
export function useLocalePath() {
  return useCallback((path: string) => path.startsWith("/") ? path : `/${path}`, []);
}
