import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../types/domain';
import { products } from '../mocks/catalog';
import { getAvailableStock } from './orderStore';

/**
 * Keranjang — F-07.
 * Hanya menerima varian ready stock aktif dan berstok (FR-07-01, AC-07-04).
 * Reservasi stok TIDAK terjadi di sini; itu terjadi saat order dibuat (FR-07-05).
 */
interface CartState {
  items: CartItem[];
  add: (productId: string, variantId: string, qty: number) => { ok: boolean; reason?: string };
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => { ok: boolean; reason?: string };
  clear: () => void;
  mergeGuestIntoAccount: () => void; // no-op placeholder untuk FR-01-08/FR-07-04
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (productId, variantId, qty) => {
        const product = products.find((p) => p.id === productId);
        const variant = product?.variants.find((v) => v.id === variantId);

        if (!product || !variant) return { ok: false, reason: 'not_found' };
        if (!product.active || product.saleType !== 'ready_stock') {
          return { ok: false, reason: 'not_ready_stock' }; // AC-07-04
        }
        const available = getAvailableStock(variantId);
        if (available <= 0) return { ok: false, reason: 'out_of_stock' };

        const existing = get().items.find((i) => i.variantId === variantId);
        const nextQty = (existing?.qty ?? 0) + qty;
        if (nextQty > available) {
          return { ok: false, reason: 'exceeds_stock' }; // FR-07-02 / AC-07-01
        }

        set((state) => {
          const items = existing
            ? state.items.map((i) => (i.variantId === variantId ? { ...i, qty: nextQty } : i))
            : [...state.items, { productId, variantId, qty, priceIdrAtAdd: variant.priceIdr }];
          return { items };
        });
        return { ok: true };
      },
      remove: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      setQty: (variantId, qty) => {
        const product = products.find((p) => p.variants.some((v) => v.id === variantId));
        const variant = product?.variants.find((v) => v.id === variantId);
        if (!variant) return { ok: false, reason: 'not_found' };
        if (qty > getAvailableStock(variantId)) return { ok: false, reason: 'exceeds_stock' };
        if (qty <= 0) {
          get().remove(variantId);
          return { ok: true };
        }
        set((state) => ({
          items: state.items.map((i) => (i.variantId === variantId ? { ...i, qty } : i)),
        }));
        return { ok: true };
      },
      clear: () => set({ items: [] }),
      mergeGuestIntoAccount: () => {
        /* Pada implementasi backend nyata, ini memanggil API penggabungan keranjang (AC-07-03). */
      },
    }),
    { name: 'aurelle_cart' },
  ),
);

/** Resolusi tampilan item cart + deteksi perubahan harga/stok (FR-07-03). */
export function resolveCartItem(item: CartItem) {
  const product = products.find((p) => p.id === item.productId);
  const variant = product?.variants.find((v) => v.id === item.variantId);
  const priceChanged = !!variant && variant.priceIdr !== item.priceIdrAtAdd;
  const available = variant ? getAvailableStock(variant.id) : 0;
  const unavailable = !product || !product.active || !variant || available <= 0;
  const exceedsStock = !unavailable && item.qty > available;
  return { product, variant, priceChanged, unavailable, available, exceedsStock };
}
