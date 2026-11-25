import { create } from 'zustand';
import { api } from './api';
import { collections, products, shippingServices } from '../mocks/catalog';
import { SERVED_COUNTRIES } from '../utils/checkout';
import { usePreferenceStore } from '../store/preferenceStore';
import type { Collection, Product, ShippingService } from '../types/domain';

/**
 * The catalog's source of truth is the API. The bundled catalog in `mocks/catalog` is only
 * what the site shows before the first response (or when the API is unreachable); a
 * successful load replaces its contents in place, so every existing import sees server
 * prices and server stock. `stock` from the API is already "available to buy now".
 */
const useVersion = create<{ version: number }>(() => ({ version: 0 }));

/** Subscribe a component to catalog refreshes (stock and prices are read at render time). */
export const useCatalogVersion = () => useVersion((s) => s.version);

interface CatalogResponse { products: Product[]; collections?: Collection[]; shippingServices: ShippingService[]; usdToIdr: number; servedCountries: string[] }

export async function loadCatalog(): Promise<boolean> {
  const res = await api<CatalogResponse>('/catalog');
  if (!res.ok) return false;
  products.splice(0, products.length, ...res.data.products);
  // An API from before collections were served leaves the bundled ones in place.
  if (res.data.collections) collections.splice(0, collections.length, ...res.data.collections);
  shippingServices.splice(0, shippingServices.length, ...res.data.shippingServices);
  SERVED_COUNTRIES.splice(0, SERVED_COUNTRIES.length, ...res.data.servedCountries);
  usePreferenceStore.setState({ usdToIdr: res.data.usdToIdr });
  useVersion.setState((s) => ({ version: s.version + 1 }));
  return true;
}
