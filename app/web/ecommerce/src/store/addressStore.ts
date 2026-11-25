import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address } from '../types/domain';
import { useAuthStore } from './authStore';

/**
 * Address book — one per account. The books of every account that has used this browser are
 * kept apart under the account's id: `addresses` is always the signed-in customer's own book,
 * and nobody sees another account's addresses on a shared browser. Signed out, it is empty.
 */
interface AddressState {
  /** The signed-in customer's addresses. */
  addresses: Address[];
  /** Whose book `addresses` is; null while signed out. */
  owner: string | null;
  books: Record<string, Address[]>;
  addAddress: (address: Omit<Address, 'id'>) => Address;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefault: (id: string) => void;
  getDefaultAddress: () => Address | undefined;
  /** Open the book of this account (null: signed out). */
  openFor: (userId: string | null) => void;
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => {
      /** Replace the current book, and keep the owner's stored copy in step. */
      const write = (change: (list: Address[]) => Address[]) => set((state) => {
        if (!state.owner) return state; // signed out: there is no book to write to
        const addresses = change(state.addresses);
        return { addresses, books: { ...state.books, [state.owner]: addresses } };
      });

      return {
        addresses: [],
        owner: null,
        books: {},

        addAddress: (newAddr) => {
          const created: Address = { ...newAddr, id: `addr-${Date.now()}`, isDefault: newAddr.isDefault || get().addresses.length === 0 };
          write((list) => [...(created.isDefault ? list.map((a) => ({ ...a, isDefault: false })) : list), created]);
          return created;
        },

        updateAddress: (id, partial) => write((list) => list.map((a) => (a.id === id ? { ...a, ...partial } : partial.isDefault === true ? { ...a, isDefault: false } : a))),

        deleteAddress: (id) => write((list) => {
          const left = list.filter((a) => a.id !== id);
          // The book always has a default while it has an address.
          return left.length > 0 && !left.some((a) => a.isDefault) ? left.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a)) : left;
        }),

        setDefault: (id) => write((list) => list.map((a) => ({ ...a, isDefault: a.id === id }))),

        getDefaultAddress: () => {
          const list = get().addresses;
          return list.find((a) => a.isDefault) || list[0];
        },

        openFor: (userId) => set((state) => (state.owner === userId ? state : { owner: userId, addresses: userId ? state.books[userId] ?? [] : [] })),
      };
    },
    {
      // A new key: the old one held a single list shared by every account on the browser
      // (seeded with sample addresses), with no way to tell whose each address was.
      name: 'aurelle_address_books',
      partialize: (state) => ({ books: state.books }),
    },
  ),
);

// Follow the session: signing in opens that account's book, signing out closes it.
useAddressStore.getState().openFor(useAuthStore.getState().user?.id ?? null);
useAuthStore.subscribe((auth) => useAddressStore.getState().openFor(auth.user?.id ?? null));
try { window.localStorage.removeItem('aurelle_addresses'); } catch { /* storage unavailable: nothing to clean up */ }
