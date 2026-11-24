import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Catalog, type Product, type Variant } from './api';

export interface CartLine { variantId: string; qty: number }
export interface AddressForm { recipient: string; phoneCountryCode: string; phone: string; country: string; state: string; city: string; postalCode: string; line1: string }

interface ShopValue {
  /** null while loading; reload() refreshes prices and stock from the API. */
  catalog: Catalog | null;
  offline: boolean;
  reload: () => Promise<void>;
  cart: CartLine[];
  /** Sets the quantity for a variant (0 removes it), capped at the stock the API reports. */
  setQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  find: (variantId: string) => { product: Product; variant: Variant } | undefined;
  address: AddressForm;
  saveAddress: (address: AddressForm) => void;
}

const CART_KEY = 'aurelle_cart';
const ADDRESS_KEY = 'aurelle_address';
const EMPTY_ADDRESS: AddressForm = { recipient: '', phoneCountryCode: '+62', phone: '', country: 'Indonesia', state: '', city: '', postalCode: '', line1: '' };
const ShopContext = createContext<ShopValue | null>(null);

/** Catalog from the API plus the cart and delivery address kept on the device. */
export function ShopProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [offline, setOffline] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);

  const reload = useCallback(async () => {
    const res = await api<Catalog>('/catalog');
    setOffline(!res.ok);
    if (res.ok) setCatalog(res.data);
  }, []);

  useEffect(() => {
    void api<Catalog>('/catalog').then((res) => {
      setOffline(!res.ok);
      if (res.ok) setCatalog(res.data);
    });
    void AsyncStorage.multiGet([CART_KEY, ADDRESS_KEY]).then(([savedCart, savedAddress]) => {
      try {
        if (savedCart[1]) setCart((JSON.parse(savedCart[1]) as CartLine[]).filter((l) => typeof l.variantId === 'string' && Number.isInteger(l.qty) && l.qty > 0));
        if (savedAddress[1]) setAddress({ ...EMPTY_ADDRESS, ...(JSON.parse(savedAddress[1]) as Partial<AddressForm>) });
      } catch { /* damaged storage: start empty */ }
    });
  }, []);

  const find = useCallback((variantId: string) => {
    for (const product of catalog?.products ?? []) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) return { product, variant };
    }
  }, [catalog]);

  const persistCart = (next: CartLine[]) => { setCart(next); void AsyncStorage.setItem(CART_KEY, JSON.stringify(next)); };

  const setQty = useCallback((variantId: string, qty: number) => {
    const stock = find(variantId)?.variant.stock ?? 0;
    const capped = Math.max(0, Math.min(qty, stock, 99));
    setCart((current) => {
      const next = capped === 0 ? current.filter((l) => l.variantId !== variantId)
        : current.some((l) => l.variantId === variantId) ? current.map((l) => (l.variantId === variantId ? { ...l, qty: capped } : l))
        : [...current, { variantId, qty: capped }];
      void AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, [find]);

  const value = useMemo<ShopValue>(() => ({
    catalog, offline, reload, cart, setQty, find, address,
    clearCart: () => persistCart([]),
    saveAddress: (next) => { setAddress(next); void AsyncStorage.setItem(ADDRESS_KEY, JSON.stringify(next)); },
  }), [catalog, offline, reload, cart, setQty, find, address]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopValue {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}

export const CATEGORY: Record<string, string> = { necklace: 'Necklaces', earring: 'Earrings', ring: 'Rings', bracelet: 'Bracelets' };
