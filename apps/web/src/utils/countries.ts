/**
 * Daftar negara untuk form alamat (F-02).
 * FR-02-04: daftar ini TIDAK menjanjikan layanan kirim — ketersediaan diperiksa saat checkout.
 * Aturan format per negara di sini adalah default kerja [U]; validasi final ada di backend.
 */
export interface CountryOption {
  name: string;
  dialCode: string;
  /** Negara tanpa sistem kode pos umum → kode pos opsional (FR-02-02 "field mengikuti format negara"). */
  postalOptional?: boolean;
}

export const COUNTRIES: CountryOption[] = [
  { name: 'Indonesia', dialCode: '+62' },
  { name: 'Singapore', dialCode: '+65' },
  { name: 'Malaysia', dialCode: '+60' },
  { name: 'Thailand', dialCode: '+66' },
  { name: 'Philippines', dialCode: '+63' },
  { name: 'Vietnam', dialCode: '+84' },
  { name: 'Japan', dialCode: '+81' },
  { name: 'South Korea', dialCode: '+82' },
  { name: 'Hong Kong', dialCode: '+852', postalOptional: true },
  { name: 'Australia', dialCode: '+61' },
  { name: 'New Zealand', dialCode: '+64' },
  { name: 'United States', dialCode: '+1' },
  { name: 'Canada', dialCode: '+1' },
  { name: 'United Kingdom', dialCode: '+44' },
  { name: 'Germany', dialCode: '+49' },
  { name: 'France', dialCode: '+33' },
  { name: 'Netherlands', dialCode: '+31' },
  { name: 'United Arab Emirates', dialCode: '+971', postalOptional: true },
  { name: 'Saudi Arabia', dialCode: '+966' },
];

export function getCountry(name: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.name === name);
}
