/**
 * Daftar negara untuk form alamat (F-02).
 * FR-02-04: daftar ini TIDAK menjanjikan layanan kirim — ketersediaan diperiksa saat checkout.
 * Aturan format per negara di sini adalah default kerja [U]; validasi final ada di backend.
 */
export interface CountryOption {
  /** English name: what an address stores, and what the API compares with the countries it ships to. */
  name: string;
  /** ISO 3166-1 alpha-2 code: the flag, and the name in the visitor's language. */
  iso: string;
  dialCode: string;
  /** Negara tanpa sistem kode pos umum → kode pos opsional (FR-02-02 "field mengikuti format negara"). */
  postalOptional?: boolean;
}

export const COUNTRIES: CountryOption[] = [
  { name: 'Indonesia', iso: 'ID', dialCode: '+62' },
  { name: 'Singapore', iso: 'SG', dialCode: '+65' },
  { name: 'Malaysia', iso: 'MY', dialCode: '+60' },
  { name: 'Thailand', iso: 'TH', dialCode: '+66' },
  { name: 'Philippines', iso: 'PH', dialCode: '+63' },
  { name: 'Vietnam', iso: 'VN', dialCode: '+84' },
  { name: 'Japan', iso: 'JP', dialCode: '+81' },
  { name: 'South Korea', iso: 'KR', dialCode: '+82' },
  { name: 'Hong Kong', iso: 'HK', dialCode: '+852', postalOptional: true },
  { name: 'Australia', iso: 'AU', dialCode: '+61' },
  { name: 'New Zealand', iso: 'NZ', dialCode: '+64' },
  { name: 'United States', iso: 'US', dialCode: '+1' },
  { name: 'Canada', iso: 'CA', dialCode: '+1' },
  { name: 'United Kingdom', iso: 'GB', dialCode: '+44' },
  { name: 'Germany', iso: 'DE', dialCode: '+49' },
  { name: 'France', iso: 'FR', dialCode: '+33' },
  { name: 'Netherlands', iso: 'NL', dialCode: '+31' },
  { name: 'United Arab Emirates', iso: 'AE', dialCode: '+971', postalOptional: true },
  { name: 'Saudi Arabia', iso: 'SA', dialCode: '+966' },
];

export function getCountry(name: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.name === name);
}
