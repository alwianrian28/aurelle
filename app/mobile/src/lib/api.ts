import { Platform } from 'react-native';

/**
 * Client for the Aurelle API (the same FastAPI service the website uses).
 * The session is the API's httpOnly cookie, kept by the OS cookie store, so there is no
 * token for the app to hold or leak. Never throws: callers branch on `ok`.
 */
const BASE = process.env.EXPO_PUBLIC_API_URL ?? Platform.select({ android: 'http://10.0.2.2:8000', default: 'http://localhost:8000' });

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; retryAfterMs?: number };

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'server_error', retryAfterMs: typeof data.retryAfterMs === 'number' ? data.retryAfterMs : undefined };
  } catch {
    return { ok: false, status: 0, error: 'network' }; // offline, or the API is unreachable
  }
}

/** Absolute URL for a catalog image path such as "/media/thumbs/x.webp". */
export const mediaUrl = (path: string) => `${BASE}${encodeURI(path)}`;

export type Category = 'ring' | 'necklace' | 'bracelet' | 'earring';
export interface Variant { id: string; sku: string; label: { id: string; en: string }; size: string | null; priceIdr: number; stock: number }
export interface Product {
  id: string;
  slug: string;
  name: { id: string; en: string };
  description: { id: string; en: string };
  materials: { id: string; en: string };
  category: Category;
  thumb: string;
  media: { id: string; src: string }[];
  variants: Variant[];
}
export interface ShippingService { id: string; courier: string; name: { id: string; en: string }; etaDays: string; costIdr: number }
export interface Catalog { products: Product[]; shippingServices: ShippingService[]; usdToIdr: number; servedCountries: string[] }
export interface Costs { subtotal: number; tax: number; shipping: number; duty: number; other: number; total: number }

export interface User { id: string; email: string; username: string; emailVerified: boolean; role: 'customer' | 'admin' }
export interface TrackingPoint { id: number; label: string; note: string; lat: number; lng: number; at: string }
export interface Order {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: { variantId: string; name: { id: string; en: string }; variantLabel?: { id?: string; en?: string }; qty: number; unitPriceIdr: number }[];
  costs: Costs;
  reservationExpiresAt: string;
  history: { status: string; paymentStatus: string; at: string }[];
  tracking: { courier: string | null; trackingNumber: string | null; points: TrackingPoint[] };
}
