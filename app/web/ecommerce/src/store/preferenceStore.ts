import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency } from '../types/domain';
import { currencyRate } from '../mocks/catalog';

/**
 * Preferensi mata uang — F-03.
 * Jika kurs USD kedaluwarsa, mata uang kembali ke IDR (AC-03-06).
 */
interface PreferenceState {
  currency: Currency;
  usdToIdr: number;
  rateExpiresAt: string;
  setCurrency: (c: Currency) => void;
  isUsdAvailable: () => boolean;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set, get) => ({
      currency: 'IDR',
      usdToIdr: currencyRate.usdToIdr,
      rateExpiresAt: currencyRate.expiresAt,
      isUsdAvailable: () => new Date(get().rateExpiresAt).getTime() > Date.now(),
      setCurrency: (c) => {
        if (c === 'USD' && !get().isUsdAvailable()) {
          set({ currency: 'IDR' });
          return;
        }
        set({ currency: c });
      },
    }),
    {
      name: 'aurelle_preferences',
      partialize: (s) => ({ currency: s.currency }),
    },
  ),
);
