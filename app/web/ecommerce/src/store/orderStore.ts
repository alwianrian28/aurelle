import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Order,
  OrderStatusEvent,
  PaymentMethod,
  PaymentStatus,
  ReadyStockOrderStatus,
} from '../types/domain';
import { products } from '../mocks/catalog';

/**
 * Pesanan ready stock — F-08 & F-18. Cermin lokal dari pesanan di API:
 * - Pesanan dibuat server (`placeOrder` di lib/orderSync): harga, stok, reservasi, total.
 * - Di sini hanya simulasi gateway pembayaran sampai provider terhubung: redirect tidak
 *   pernah menandai lunas, hanya "webhook" (FR-08-09); hasilnya dikirim ke API.
 * - Status, riwayat, dan tracking selalu ditimpa dari server saat sinkronisasi.
 */

/** OD-08 (durasi reservasi) masih terbuka — 30 menit adalah default kerja [U]; ditegakkan server. */
export const RESERVATION_MINUTES = 30;
/** Simulasi jeda webhook gateway setelah redirect sukses. */
const WEBHOOK_DELAY_MS = 2500;

interface OrderState {
  orders: Order[];
  /** Pelanggan mencoba bayar (lagi) di gateway. Order yang sama dipakai ulang. */
  startPayment: (orderId: string, method: PaymentMethod) => void;
  /** Hasil redirect gateway. Redirect TIDAK mengubah status menjadi lunas (FR-08-09). */
  handleGatewayRedirect: (orderId: string, outcome: 'success' | 'failed') => void;
  /** Webhook terverifikasi — satu-satunya sumber status lunas. */
  receiveWebhook: (orderId: string, outcome: 'paid' | 'failed') => void;
  /** Kedaluwarsakan order yang lewat jendela reservasi (AC-08-04). */
  expireStale: () => void;
}

const nowIso = () => new Date().toISOString();

function event(status: ReadyStockOrderStatus, paymentStatus: PaymentStatus): OrderStatusEvent {
  return { status, paymentStatus, at: nowIso() };
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],

      startPayment: (orderId, method) => {
        get().expireStale();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.status === 'awaiting_payment' ? { ...o, paymentMethod: method } : o,
          ),
        }));
      },

      handleGatewayRedirect: (orderId, outcome) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status !== 'awaiting_payment') return;

        if (outcome === 'failed') {
          // Pembayaran gagal: order tetap awaiting_payment sampai reservasi habis (F-08 alt flow)
          get().receiveWebhook(orderId, 'failed');
          return;
        }

        // Redirect sukses → hanya "pending" (menunggu konfirmasi), BUKAN lunas (AC-08-05)
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: 'pending', history: [...o.history, event(o.status, 'pending')] }
              : o,
          ),
        }));
        // Simulasi webhook terverifikasi yang tiba belakangan dari provider
        window.setTimeout(() => get().receiveWebhook(orderId, 'paid'), WEBHOOK_DELAY_MS);
      },

      receiveWebhook: (orderId, outcome) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            if (outcome === 'paid') {
              // Pembayaran setelah order kedaluwarsa → antrean review Finance (F-08 alt flow)
              if (o.status === 'cancelled') {
                return { ...o, paymentStatus: 'review_finance', history: [...o.history, event(o.status, 'review_finance')] };
              }
              if (o.status !== 'awaiting_payment') return o;
              return {
                ...o,
                status: 'confirmed',
                paymentStatus: 'paid',
                history: [...o.history, event('confirmed', 'paid')],
              };
            }
            if (o.status !== 'awaiting_payment') return o;
            return { ...o, paymentStatus: 'failed', history: [...o.history, event(o.status, 'failed')] };
          }),
        }));
      },

      expireStale: () => {
        const now = Date.now();
        const stale = get().orders.some(
          (o) => o.status === 'awaiting_payment' && o.paymentStatus !== 'pending' && new Date(o.reservationExpiresAt).getTime() <= now,
        );
        if (!stale) return;
        set((s) => ({
          orders: s.orders.map((o) =>
            o.status === 'awaiting_payment' &&
            o.paymentStatus !== 'pending' &&
            new Date(o.reservationExpiresAt).getTime() <= now
              ? {
                  ...o,
                  status: 'cancelled',
                  paymentStatus: 'expired',
                  cancelReason: 'payment_expired',
                  history: [...o.history, event('cancelled', 'expired')],
                }
              : o,
          ),
        }));
      },
    }),
    { name: 'aurelle_orders' },
  ),
);

function findVariant(variantId: string) {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return v;
  }
  return undefined;
}

/**
 * Stok yang bisa dibeli sekarang. Angkanya dihitung server (stok − reservasi − terjual)
 * dan dibawa oleh katalog dari API; klien tidak lagi menghitung reservasi sendiri.
 */
export function getAvailableStock(variantId: string): number {
  return Math.max(0, findVariant(variantId)?.stock ?? 0);
}

/** Aksi yang valid untuk status saat ini (FR-18-04). */
export function canPay(order: Order): boolean {
  return (
    order.status === 'awaiting_payment' &&
    order.paymentStatus !== 'pending' &&
    new Date(order.reservationExpiresAt).getTime() > Date.now()
  );
}
