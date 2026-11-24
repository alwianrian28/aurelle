import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { I18nText, Locale } from '../types/domain';
import { usePreferenceStore } from '../store/preferenceStore';
import { formatPriceFromIdr } from '../utils/currency';

/** Locale aktif yang dinormalisasi ke 'id' | 'en'. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('id') ? 'id' : 'en';
}

/** Memilih teks bilingual sesuai locale aktif. */
export function useLocalized() {
  const locale = useLocale();
  return useCallback((text: I18nText | undefined) => (text ? text[locale] || text.en : ''), [locale]);
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
