import { api } from './api';
import { applyServerOrder } from './orderSync';
import type { Order, PaymentMethod } from '../types/domain';

/**
 * Midtrans Snap on the payment page.
 * Midtrans' own form (card fields, or the QRIS code) is shown inside our page, so card
 * details go from the customer straight to Midtrans and never pass through Aurelle.
 * The form's callbacks only tell us the customer is done with it. Whether the order is paid
 * is always decided by the API, which hears it from Midtrans itself (FR-08-09).
 */

/** What the form reports when the customer is done with it. Never proof of payment. */
export type SnapOutcome = 'success' | 'pending' | 'error' | 'closed';
interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}
declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: SnapCallbacks) => void;
      embed?: (token: string, options: SnapCallbacks & { embedId: string }) => void;
      hide?: () => void;
    };
  }
}

export interface PaymentConfig {
  midtransClientKey: string | null;
  snapUrl: string | null;
}

let config: Promise<PaymentConfig> | null = null;
/** Whether card/QRIS payments are switched on, and what the page needs to show Snap. */
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
export async function syncPayment(orderId: string): Promise<Order | null> {
  const res = await api<{ order: Order }>(`/payments/${orderId}/sync`, { method: 'POST' });
  if (!res.ok) return null;
  applyServerOrder(res.data.order);
  return res.data.order;
}

export type PayProblem = 'unavailable' | 'network' | 'not_allowed';

/**
 * Shows Midtrans' payment form for an order inside the element with id `embedId`, offering
 * the given method. Asking for the other method starts a new attempt for the same order.
 * `onOutcome` fires when the customer finishes with the form; read the order from the API
 * afterwards to learn what actually happened.
 */
export async function showPaymentForm(orderId: string, method: PaymentMethod, embedId: string, onOutcome: (outcome: SnapOutcome) => void): Promise<PayProblem | null> {
  const { midtransClientKey, snapUrl } = await loadPaymentConfig();
  if (!midtransClientKey || !snapUrl) return 'unavailable';
  const res = await api<{ token: string }>(`/payments/${orderId}/snap`, { body: { method } });
  if (!res.ok) {
    if (res.status === 409) await syncPayment(orderId); // already paid, cancelled or expired
    return res.status === 0 ? 'network' : res.status === 409 ? 'not_allowed' : 'unavailable';
  }
  try {
    await loadSnap(snapUrl, midtransClientKey);
  } catch {
    return 'network';
  }
  // The element may be gone by now (the customer switched method or left the page).
  if (!window.snap?.embed || !document.getElementById(embedId)) return window.snap?.embed ? null : 'unavailable';
  hidePaymentForm();
  const report = (outcome: SnapOutcome) => () => onOutcome(outcome);
  window.snap.embed(res.data.token, { embedId, onSuccess: report('success'), onPending: report('pending'), onError: report('error'), onClose: report('closed') });
  return null;
}

/** Takes the form down again (leaving the page, or before showing another attempt). */
export function hidePaymentForm(): void {
  try { window.snap?.hide?.(); } catch { /* nothing was showing */ }
}
