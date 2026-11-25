import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';

/**
 * Wishlist — F-05 [R1]. Hanya untuk pengguna login (FR-05-02 [A], OD-30).
 * Produk yang sama tidak boleh tercatat dua kali (FR-05-01).
 * One list per account: `productIds` is the signed-in customer's own, kept apart from the
 * lists of other accounts that used this browser. Signed out, it is empty.
 */
interface WishlistState {
  productIds: string[];
  owner: string | null;
  lists: Record<string, string[]>;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  openFor: (userId: string | null) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      owner: null,
      lists: {},
      has: (productId) => get().productIds.includes(productId),
      toggle: (productId) =>
        set((state) => {
          if (!state.owner) return state;
          const productIds = state.productIds.includes(productId) ? state.productIds.filter((id) => id !== productId) : [...state.productIds, productId];
          return { productIds, lists: { ...state.lists, [state.owner]: productIds } };
        }),
      openFor: (userId) => set((state) => (state.owner === userId ? state : { owner: userId, productIds: userId ? state.lists[userId] ?? [] : [] })),
    }),
    // A new key: the old one held one list shared by every account on the browser.
    { name: 'aurelle_wishlists', partialize: (state) => ({ lists: state.lists }) },
  ),
);

useWishlistStore.getState().openFor(useAuthStore.getState().user?.id ?? null);
useAuthStore.subscribe((auth) => useWishlistStore.getState().openFor(auth.user?.id ?? null));
try { window.localStorage.removeItem('aurelle_wishlist'); } catch { /* storage unavailable: nothing to clean up */ }
