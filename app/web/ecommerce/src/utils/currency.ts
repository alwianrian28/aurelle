import type { Currency, Locale } from '../types/domain';
import { intlLocale } from '../i18n';

/**
 * Konversi dan format mata uang — PRD BR-08 [R1] & §13.2.
 * Harga basis selalu IDR; USD adalah hasil konversi dari kurs aktif, bukan input manual.
 */

export function convertFromIdr(priceIdr: number, currency: Currency, usdToIdr: number): number {
  if (currency === 'IDR') return priceIdr;
  return priceIdr / usdToIdr;
}

export function formatMoney(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount);
}

/** Helper gabungan: dari harga basis IDR langsung ke string terformat pada mata uang aktif. */
export function formatPriceFromIdr(
  priceIdr: number,
  currency: Currency,
  usdToIdr: number,
  locale: Locale,
): string {
  return formatMoney(convertFromIdr(priceIdr, currency, usdToIdr), currency, locale);
}

/**
 * Format nominal order memakai kurs yang DIKUNCI pada order (FR-08-06, AC-03-03),
 * bukan kurs aktif — perubahan kurs setelah order dibuat tidak mengubah tampilan total.
 */
export function formatOrderMoney(
  amountIdr: number,
  order: { currency: Currency; lockedRate?: { usdToIdr: number } },
  locale: Locale,
): string {
  if (order.currency === 'USD' && order.lockedRate) {
    return formatMoney(amountIdr / order.lockedRate.usdToIdr, 'USD', locale);
  }
  return formatMoney(amountIdr, 'IDR', locale);
}
