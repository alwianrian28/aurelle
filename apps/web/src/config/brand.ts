/**
 * Konfigurasi kontak brand.
 *
 * PERHATIAN — PLACEHOLDER [A]:
 * Kontak resmi Aurelle (nomor WhatsApp, email, alamat studio) belum diberikan dan bergantung
 * pada aset brand final (OD-17). Nilai di bawah hanya untuk pengembangan dan WAJIB diganti
 * dari Pengaturan (F-26) / CMS (F-20) sebelum rilis.
 */
export const BRAND_CONTACT = {
  /** Format E.164 tanpa "+" untuk tautan wa.me. */
  whatsappE164: '6281100000000',
  whatsappDisplay: '+62 811-0000-0000',
  email: 'hello@aurelle.example',
  hours: { id: 'Senin–Jumat, 09.00–17.00 WIB', en: 'Mon–Fri, 09:00–17:00 (GMT+7)' },
  isPlaceholder: true,
} as const;

/** Versi teks consent newsletter (FR-06-04). Naikkan saat teks berubah. */
export const NEWSLETTER_CONSENT_VERSION = 'nl-consent-2026-10-draft';

/**
 * Tautan WhatsApp untuk konsultasi (FR-09-03, AC-09-02):
 * hanya memuat nomor pengajuan — tidak ada email, telepon, atau alamat pelanggan.
 */
export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${BRAND_CONTACT.whatsappE164}?text=${encodeURIComponent(message)}`;
}
