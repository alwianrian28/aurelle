import { api } from './api';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { loadCatalog } from './catalogSync';
import type { Address, CartItem, Currency, Order, PaymentMethod } from '../types/domain';

/**
 * Keeps the local order store and the API in step.
 * - placeOrder: checkout is created by the server (where the admin desk sees it at once).
 * - Push: the demo payment simulator's outcomes follow as payment events.
 * - Pull: the server is the authority for status, payment status, history and tracking,
 *   so admin updates reach the customer.
 */
const sent = new Map<string, number>(); // order id -> history length already on the server
let applying = false;
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (job: () => Promise<unknown>) => { queue = queue.then(job).catch(() => undefined); };

function applyServer(order: Order) {
  applying = true;
  useOrderStore.setState((s) => ({ orders: s.orders.some((o) => o.id === order.id) ? s.orders.map((o) => (o.id === order.id ? order : o)) : [order, ...s.orders] }));
  applying = false;
  sent.set(order.id, order.history.length);
}

export interface PlaceOrderInput {
  items: CartItem[];
  /** Price per variant as shown when checkout opened; the server refuses a stale one. */
  expectedPrices: Record<string, number>;
  address: Address;
  shippingServiceId: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
}
export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'price_changed' | 'out_of_stock' | 'unverified' | 'country' | 'network' | 'invalid' };

/**
 * Checkout: the server validates price and stock, reserves the units and prices the order
 * (FR-08-04/05/06). The same id is reused on retry, so a double submit cannot create two orders.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { id: _id, isDefault: _default, ...address } = input.address;
  const res = await api<{ order: Order }>('/orders', {
    body: {
      id: `ord-${crypto.randomUUID()}`,
      items: input.items.map((i) => ({ variantId: i.variantId, qty: i.qty, expectedPriceIdr: input.expectedPrices[i.variantId] ?? 0 })),
      address: { ...address, postalCode: address.postalCode ?? '', line2: address.line2 || null },
      shippingServiceId: input.shippingServiceId,
      paymentMethod: input.paymentMethod,
      currency: input.currency,
    },
  });
  void loadCatalog(); // stock (and any changed price) is fresh for the next render
  if (res.ok) {
    applyServer(res.data.order);
    return { ok: true, order: res.data.order };
  }
  const reason = res.status === 0 ? 'network' : res.error === 'price_changed' || res.error === 'out_of_stock' ? res.error : res.error === 'email_unverified' ? 'unverified' : res.error === 'country_not_served' ? 'country' : 'invalid';
  return { ok: false, reason };
}

async function pushPayment(order: Order) {
  const res = await api<{ order: Order }>(`/orders/${order.id}/demo-payment`, { body: { paymentStatus: order.paymentStatus } });
  if (res.ok) applyServer(res.data.order);
  else if (res.status === 409) await pullOrders(); // the server already moved on
}

/** Fetch the signed-in customer's orders and reconcile. */
export async function pullOrders(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  const res = await api<{ orders: Order[] }>('/orders');
  if (!res.ok) return;
  res.data.orders.forEach(applyServer);
}

/** Call once at startup. */
export function startOrderSync(): void {
  for (const o of useOrderStore.getState().orders) sent.set(o.id, o.history.length);
  useOrderStore.subscribe((state) => {
    if (applying) return;
    const userId = useAuthStore.getState().user?.id;
    for (const order of state.orders) {
      if (order.userId !== userId) continue;
      const known = sent.get(order.id);
      if (known === undefined) {
        sent.set(order.id, order.history.length);
      } else if (order.history.length > known) {
        sent.set(order.id, order.history.length);
        // Expiry is decided by the server on its own; only gateway outcomes are reported.
        if (['pending', 'failed', 'paid'].includes(order.paymentStatus)) enqueue(() => pushPayment(order));
      }
    }
  });
}
