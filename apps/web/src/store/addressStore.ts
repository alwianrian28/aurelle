import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address } from '../types/domain';

interface AddressState {
  addresses: Address[];
  addAddress: (address: Omit<Address, 'id'>) => Address;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefault: (id: string) => void;
  getDefaultAddress: () => Address | undefined;
}

const initialAddresses: Address[] = [
  {
    id: 'addr-default-1',
    recipient: 'Alwi Anrianto',
    phoneCountryCode: '+62',
    phone: '81234567890',
    country: 'Indonesia',
    state: 'DKI Jakarta',
    city: 'Jakarta Selatan',
    postalCode: '12190',
    line1: 'Jl. Jend. Sudirman No. 52-53, Senayan',
    line2: 'Gedung Aurelle Tower Lt. 12',
    isDefault: true,
  },
  {
    id: 'addr-intl-2',
    recipient: 'Alwi Anrianto (Singapore)',
    phoneCountryCode: '+65',
    phone: '91234567',
    country: 'Singapore',
    state: 'Central Region',
    city: 'Singapore',
    postalCode: '238881',
    line1: '1 Orchard Turn, #03-01 ION Orchard',
    isDefault: false,
  },
];

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: initialAddresses,

      addAddress: (newAddr) => {
        const id = `addr-${Date.now()}`;
        const isFirst = get().addresses.length === 0;
        const created: Address = {
          ...newAddr,
          id,
          isDefault: newAddr.isDefault || isFirst,
        };

        set((state) => {
          let updated = state.addresses;
          if (created.isDefault) {
            updated = updated.map((a) => ({ ...a, isDefault: false }));
          }
          return { addresses: [...updated, created] };
        });

        return created;
      },

      updateAddress: (id, partial) => {
        set((state) => {
          const isSettingDefault = partial.isDefault === true;
          return {
            addresses: state.addresses.map((a) => {
              if (a.id === id) {
                return { ...a, ...partial };
              }
              if (isSettingDefault) {
                return { ...a, isDefault: false };
              }
              return a;
            }),
          };
        });
      },

      deleteAddress: (id) => {
        set((state) => {
          const filtered = state.addresses.filter((a) => a.id !== id);
          const needsDefault = filtered.length > 0 && !filtered.some((a) => a.isDefault);
          return {
            addresses: needsDefault ? filtered.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a)) : filtered,
          };
        });
      },

      setDefault: (id) => {
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        }));
      },

      getDefaultAddress: () => {
        const list = get().addresses;
        return list.find((a) => a.isDefault) || list[0];
      },
    }),
    { name: 'aurelle_addresses' },
  ),
);
