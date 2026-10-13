import type { CostBreakdown } from '../types/domain';

/**
 * Estimasi rincian biaya checkout ready stock (BR-15, FR-08-03).
 * Aturan pajak final (OD-16) dan penyedia kalkulasi bea/kurir (OD-12) belum ditetapkan
 * pada PRD. Nilai di bawah adalah ESTIMASI kerja [U] agar UI tetap dapat menampilkan
 * rincian biaya terpisah sesuai mandat BR-15, bukan aturan bisnis final.
 */
export function computeCostBreakdown(subtotalIdr: number, shippingCostIdr: number): CostBreakdown {
  const tax = 0; // OD-16 belum ditetapkan — ditampilkan apa adanya dengan keterangan di UI
  const duty = Math.round((subtotalIdr * 0.05) / 1000) * 1000; // estimasi 5%, OD-12 belum final
  const other = 0;
  const total = subtotalIdr + tax + shippingCostIdr + duty + other;
  return { subtotal: subtotalIdr, tax, shipping: shippingCostIdr, duty, other, total };
}

/** Negara yang dilayani checkout saat ini (mock). FR-02-04: daftar negara pada form alamat tidak menjanjikan layanan. */
export const SERVED_COUNTRIES = ['Indonesia', 'Singapore', 'Malaysia', 'United States', 'Australia'];
