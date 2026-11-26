import { api } from './api';
import type { CartItem, OrderTracking } from '../types/domain';

/** A courier service with the price the courier gives right now (Biteship, through the API). */
export interface CourierRate {
  courier: string;
  courierName: string;
  service: string;
  serviceName: string;
  description: string;
  /** What the customer pays: the shipping fee plus insurance for the goods' full value. */
  priceIdr: number;
  insuranceIdr: number;
  /** e.g. "2 - 3" */
  eta: string;
  etaUnit: string;
}

/** Live rates are for parcels within Indonesia, addressed by a 5-digit postal code. */
export function canQuoteLive(country: string | undefined, postalCode: string | undefined): boolean {
  return country === 'Indonesia' && /^\d{5}$/.test((postalCode ?? '').trim());
}

/**
 * Courier rates for a cart sent to a postal code, cheapest first. `null` when live rates
 * cannot be had (not set up, the courier service is down, offline): checkout then offers the
 * store's own shipping services instead.
 */
export async function loadCourierRates(items: CartItem[], postalCode: string): Promise<CourierRate[] | null> {
  const res = await api<{ rates: CourierRate[] }>('/shipping/rates', {
    body: { items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })), postalCode: postalCode.trim(), country: 'Indonesia' },
  });
  return res.ok && res.data.rates.length > 0 ? res.data.rates : null;
}

/**
 * Where one of the customer's own orders is, read from the courier now: the scans and, once
 * one is assigned, the driver. `null` when it cannot be had; the order's stored status still shows.
 */
export async function loadOrderTracking(orderId: string): Promise<OrderTracking | null> {
  const res = await api<{ tracking: OrderTracking }>(`/orders/${orderId}/tracking`);
  return res.ok ? res.data.tracking : null;
}
