import type { Address } from '../types/domain';
import { getCountry } from './countries';

export type AddressDraft = Omit<Address, 'id'>;
export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;

/**
 * Validasi alamat (FR-02-01..03, AC-02-03).
 * Mengembalikan kunci i18n per field agar pesan tampil dalam bahasa aktif.
 */
export function validateAddress(a: AddressDraft): AddressErrors {
  const e: AddressErrors = {};
  if (!a.recipient.trim()) e.recipient = 'address.errors.required';
  // AC-02-03: telepon tanpa kode negara ditolak
  if (!/^\+\d{1,4}$/.test(a.phoneCountryCode.trim())) e.phoneCountryCode = 'address.errors.dialCode';
  if (!/^\d{6,15}$/.test(a.phone.replace(/[\s-]/g, ''))) e.phone = 'address.errors.phone';
  if (!a.country) e.country = 'address.errors.required';
  if (!a.state.trim()) e.state = 'address.errors.required';
  if (!a.city.trim()) e.city = 'address.errors.required';
  const country = getCountry(a.country);
  if (!country?.postalOptional && !a.postalCode.trim()) e.postalCode = 'address.errors.postal';
  if (!a.line1.trim()) e.line1 = 'address.errors.required';
  return e;
}

/** FR-02-03 / AC-02-05: alamat & telepon lengkap sebelum checkout. */
export function isAddressComplete(a: Address | undefined): boolean {
  if (!a) return false;
  return Object.keys(validateAddress(a)).length === 0;
}
