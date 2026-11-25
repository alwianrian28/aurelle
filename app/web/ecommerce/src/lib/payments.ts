import { api } from './api';
import { applyServerOrder } from './orderSync';
import type { Order } from '../types/domain';

/**
 * Midtrans Snap on the payment page.
 * The popup's callbacks only tell us the customer is done with it. Whether the order is paid
 * is always decided by the API, which hears it from Midtrans itself (FR-08-09).
 */

interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}
declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void; hide?: () => void };
  }
}

export interface PaymentConfig {
  midtransClientKey: string | null;
  snapUrl: string | null;
}

let config: Promise<PaymentConfig> | null = null;
/** Whether card/QRIS payments are switched on, and what the page needs to open Snap. */
export function loadPaymentConfig(): Promise<PaymentConfig> {
  config ??= api<PaymentConfig>('/payments/config').then((res) => {
    if (res.ok) return res.data;
    config = null; // offline: try again next time
    return { midtransClientKey: null, snapUrl: null };
  });
  return config;
}

let snapScript: Promise<void> | null = null;
function loadSnap(url: string, clientKey: string): Promise<void> {
  snapScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.clientKey = clientKey;
    script.onload = () => resolve();
    script.onerror = () => { snapScript = null; script.remove(); reject(new Error('snap')); };
    document.head.appendChild(script);
  });
  return snapScript;
}

/** Ask the API to check this order's payment at Midtrans now, and take over its answer. */
export async function syncPayment(orderId: string): Promise<void> {
  const res = await api<{ order: Order }>(`/payments/${orderId}/sync`, { method: 'POST' });
  if (res.ok) applyServerOrder(res.data.order);
}

export type PayResult = 'done' | 'closed' | 'unavailable' | 'network' | 'not_allowed';

/**
 * Open the Snap popup for an order. Resolves when the customer finishes or closes it, after
 * the order has been refreshed from the server.
 */
export async function payWithSnap(orderId: string): Promise<PayResult> {
  const { midtransClientKey, snapUrl } = await loadPaymentConfig();
  if (!midtransClientKey || !snapUrl) return 'unavailable';
  const res = await api<{ token: string }>(`/payments/${orderId}/snap`, { method: 'POST' });
  if (!res.ok) {
    if (res.status === 409) await syncPayment(orderId); // already paid, cancelled or expired
    return res.status === 0 ? 'network' : res.status === 409 ? 'not_allowed' : 'unavailable';
  }
  try {
    await loadSnap(snapUrl, midtransClientKey);
  } catch {
    return 'network';
  }
  if (!window.snap) return 'unavailable';
  return new Promise<PayResult>((resolve) => {
    const finish = (result: PayResult) => () => { void syncPayment(orderId).then(() => resolve(result)); };
    window.snap!.pay(res.data.token, { onSuccess: finish('done'), onPending: finish('done'), onError: finish('done'), onClose: finish('closed') });
  });
}
