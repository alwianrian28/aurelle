/**
 * Official Aurelle contact details and service terms (provided by the owner, Nov 2026).
 * Later these move to Settings (F-26) / CMS (F-20); set `isPlaceholder` to true to hide
 * them again and fall back to the bracketed markers below.
 */
export const BRAND_CONTACT = {
  /** E.164 without "+" for wa.me links (local number 0878-9303-6298). */
  whatsappE164: '6287893036298',
  whatsappDisplay: '0878-9303-6298',
  email: 'aurelle.jewellery28@gmail.com',
  hours: { id: 'Senin-Jumat 09.00-20.00 · Sabtu & Minggu 09.00-17.00', en: 'Mon-Fri 09:00-20:00 · Sat & Sun 09:00-17:00' },
  /** The same hours as rows, for the Contact page. */
  hoursRows: [
    { days: { id: 'Sen - Jum', en: 'Mon - Fri' }, time: '09:00 - 20:00' },
    { days: { id: 'Sab - Min', en: 'Sat - Sun' }, time: '09:00 - 17:00' },
  ],
  /** Time zone and usual reply time; null shows the pending marker until the owner confirms them. */
  hoursNote: null as { id: string; en: string } | null,
  /** Social profile URLs; null hides the link (icon stays, not clickable). */
  instagramUrl: null as string | null,
  tiktokUrl: null as string | null,
  /** Warranty length shown in the trust bar. */
  warrantyPeriod: { id: '2 tahun', en: '2-year' } as { id: string; en: string } | null,
  isPlaceholder: false as boolean,
} as const;

/**
 * Shown in place of unconfirmed brand details, matching the approved mockup's markers,
 * so nobody mistakes a development value for the real one.
 */
export const BRAND_PENDING = {
  email: '[YOUR EMAIL]',
  whatsapp: '[WHATSAPP NUMBER]',
  hours: '[OPENING HOURS]',
  hoursNote: '[Time zone, e.g. WIB] · [Usual reply time]',
  warranty: '[WARRANTY PERIOD]',
} as const;

/** Versi teks consent newsletter (FR-06-04). Naikkan saat teks berubah. */
export const NEWSLETTER_CONSENT_VERSION = 'nl-consent-2026-10-draft';

/**
 * Tautan WhatsApp untuk konsultasi (FR-09-03, AC-09-02):
 * hanya memuat nomor referensi — tidak ada email, telepon, atau alamat pelanggan.
 */
export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${BRAND_CONTACT.whatsappE164}?text=${encodeURIComponent(message)}`;
}

/** WhatsApp link once the official number is set; until then callers fall back to the Contact page. */
export function whatsAppLinkOrNull(message: string): string | null {
  return BRAND_CONTACT.isPlaceholder ? null : buildWhatsAppLink(message);
}
