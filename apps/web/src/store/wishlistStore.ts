import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Wishlist — F-05 [R1]. Hanya untuk pengguna login (FR-05-02 [A], OD-30).
 * Produk yang sama tidak boleh tercatat dua kali (FR-05-01).
 */
interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      has: (productId) => get().productIds.includes(productId),
      toggle: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((id) => id !== productId)
            : [...state.productIds, productId],
        })),
    }),
    { name: 'aurelle_wishlist' },
  ),
);
