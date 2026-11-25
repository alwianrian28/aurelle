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
  /** "own": the shop's card form (Midtrans Core API). "midtrans": Midtrans' form (Snap). */
  cardForm: 'own' | 'midtrans';
  /** "own": the shop draws the QRIS code. "midtrans": Midtrans' form (Snap) shows it. */
  qrisForm: 'own' | 'midtrans';
  environment: 'sandbox' | 'production';
}
const OFF: PaymentConfig = { midtransClientKey: null, snapUrl: null, cardForm: 'midtrans', qrisForm: 'midtrans', environment: 'sandbox' };

let config: Promise<PaymentConfig> | null = null;
/** Whether card/QRIS payments are switched on, and what the page needs to show Snap. */
export function loadPaymentConfig(): Promise<PaymentConfig> {
  config ??= api<PaymentConfig>('/payments/config').then((res) => {
    if (res.ok) return res.data;
    config = null; // offline: try again next time
    return OFF;
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

/* ------------------------------------------------------------ own card form */

interface CardTokenResponse { status_code?: string; token_id?: string; validation_messages?: string[] }
declare global {
  interface Window {
    MidtransNew3ds?: {
      getCardToken: (card: Record<string, string>, options: { onSuccess: (res: CardTokenResponse) => void; onFailure: (res: CardTokenResponse) => void }) => void;
      authenticate: (redirectUrl: string, options: { performAuthentication: (url: string) => void; onSuccess: () => void; onFailure: () => void; onPending: () => void }) => void;
    };
  }
}

// Midtrans serves one library for both environments; the tag's attributes choose between them.
const CARD_SCRIPT = 'https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js';
let cardScript: Promise<void> | null = null;
function loadCardScript({ midtransClientKey, environment }: PaymentConfig): Promise<void> {
  cardScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'midtrans-script'; // the library looks itself up by this id
    script.type = 'text/javascript';
    script.src = CARD_SCRIPT;
    script.dataset.environment = environment;
    script.dataset.clientKey = midtransClientKey ?? '';
    script.onload = () => resolve();
    script.onerror = () => { cardScript = null; script.remove(); reject(new Error('midtrans-3ds')); };
    document.head.appendChild(script);
  });
  return cardScript;
}

export interface CardInput { number: string; month: string; year: string; cvv: string }
export type CardResult =
  | { ok: true; order: Order; redirectUrl: string | null }
  | { ok: false; reason: 'card' | 'unavailable' | 'network' | 'not_allowed' };

/**
 * Pays an order with a card from the shop's own form. The card goes from this browser straight
 * to Midtrans, which answers with a one-time token; only that token is sent to our API, which
 * charges it. `redirectUrl` is set when the bank wants the customer to confirm (3-D Secure).
 */
export async function payWithCard(orderId: string, card: CardInput): Promise<CardResult> {
  const config = await loadPaymentConfig();
  if (!config.midtransClientKey || config.cardForm !== 'own') return { ok: false, reason: 'unavailable' };
  try {
    await loadCardScript(config);
  } catch {
    return { ok: false, reason: 'network' };
  }
  const midtrans = window.MidtransNew3ds;
  if (!midtrans) return { ok: false, reason: 'unavailable' };
  const token = await new Promise<string | null>((resolve) => {
    midtrans.getCardToken(
      { card_number: card.number, card_exp_month: card.month, card_exp_year: card.year, card_cvv: card.cvv },
      { onSuccess: (res) => resolve(res.token_id ?? null), onFailure: () => resolve(null) },
    );
  });
  if (!token) return { ok: false, reason: 'card' };
  const res = await api<{ order: Order; redirectUrl: string | null }>(`/payments/${orderId}/card`, { body: { tokenId: token } });
  if (res.ok) {
    applyServerOrder(res.data.order);
    return { ok: true, order: res.data.order, redirectUrl: res.data.redirectUrl ?? null };
  }
  if (res.status === 409) await syncPayment(orderId); // already paid, cancelled or expired
  return { ok: false, reason: res.status === 0 ? 'network' : res.error === 'card_rejected' ? 'card' : res.status === 409 && res.error === 'not_allowed' ? 'not_allowed' : 'unavailable' };
}

/**
 * Runs the bank's confirmation step (OTP). `show` receives the address to put in a frame;
 * the promise settles when the bank is done, whatever the result. Read the order from the API
 * afterwards: this only says the customer finished.
 */
export function confirmWithBank(redirectUrl: string, show: (url: string) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    const midtrans = window.MidtransNew3ds;
    if (!midtrans) { resolve(); return; }
    const done = () => resolve();
    midtrans.authenticate(redirectUrl, { performAuthentication: show, onSuccess: done, onFailure: done, onPending: done });
  });
}

/* ---------------------------------------------------------------- own QRIS */

export interface QrisCode { qrString: string; merchant: string | null; nmid: string | null }
export type QrisResult = { ok: true; code: QrisCode } | { ok: false; reason: PayProblem };

/**
 * The QRIS code for an order, to draw on the payment page. Each attempt has its own code;
 * asking again while it is still open returns the same one.
 */
export async function loadQrisCode(orderId: string): Promise<QrisResult> {
  const res = await api<QrisCode & { order: Order }>(`/payments/${orderId}/qris`, { method: 'POST' });
  if (res.ok) {
    applyServerOrder(res.data.order);
    return { ok: true, code: { qrString: res.data.qrString, merchant: res.data.merchant, nmid: res.data.nmid } };
  }
  if (res.status === 409) await syncPayment(orderId); // already paid, cancelled or expired
  return { ok: false, reason: res.status === 0 ? 'network' : res.status === 409 ? 'not_allowed' : 'unavailable' };
}

/** A QRIS string as a PNG picture (a data URL), `size` pixels wide. */
export async function qrPicture(qrString: string, size: number, margin = 0): Promise<string> {
  const { toDataURL } = await import('qrcode'); // only needed on this page
  return toDataURL(qrString, { width: size, margin, errorCorrectionLevel: 'M', color: { dark: '#151922', light: '#ffffff' } });
}
