import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Address,
  CartItem,
  Currency,
  Order,
  OrderStatusEvent,
  PaymentMethod,
  PaymentStatus,
  ReadyStockOrderStatus,
  ShippingService,
} from '../types/domain';
import { products } from '../mocks/catalog';
import { computeCostBreakdown } from '../utils/checkout';

/**
 * Pesanan ready stock (mock) — F-08 & F-18.
 * Mensimulasikan perilaku backend yang diwajibkan PRD:
 * - Validasi ulang harga & stok tepat sebelum order dibuat (FR-08-04, AC-08-07).
 * - Reservasi stok selama jendela pembayaran; stok tidak boleh negatif (FR-08-05).
 * - Mata uang, kurs, dan total dikunci saat order dibuat (FR-08-06).
 * - Status lunas hanya dari "webhook" terverifikasi, bukan dari redirect (FR-08-09).
 * - Retry pembayaran memakai order yang sama, tanpa order ganda (US-08-02).
 *
 * Implementasi nyata berada di backend Express (milestone berikutnya).
 */

/** OD-08 (durasi reservasi) masih terbuka — 30 menit adalah default kerja [U]. */
export const RESERVATION_MINUTES = 30;
/** Versi ketentuan yang dicatat pada order (FR-08-07). Konten final menunggu OD terkait. */
export const TERMS_VERSION = 'rs-terms-draft-2026-10';
/** Simulasi jeda webhook gateway setelah redirect sukses. */
const WEBHOOK_DELAY_MS = 2500;

const ACTIVE_RESERVATION: ReadyStockOrderStatus[] = ['awaiting_payment'];
const STOCK_COMMITTED: ReadyStockOrderStatus[] = [
  'confirmed',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'pending_decision',
];

export interface CreateOrderInput {
  userId: string;
  items: CartItem[];
  /** Harga per varian yang dilihat pelanggan saat checkout dibuka (untuk deteksi perubahan). */
  expectedPrices: Record<string, number>;
  address: Address;
  shippingService: ShippingService;
  paymentMethod: PaymentMethod;
  currency: Currency;
  usdToIdr: number;
}

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'price_changed' | 'out_of_stock' | 'empty'; variantIds?: string[] };

interface OrderState {
  orders: Order[];
  createOrder: (input: CreateOrderInput) => CreateOrderResult;
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

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `AUR-RS-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],

      createOrder: (input) => {
        if (input.items.length === 0) return { ok: false, reason: 'empty' };
        get().expireStale();

        // FR-08-04: validasi ulang harga
        const priceChanged = input.items
          .filter((i) => {
            const v = findVariant(i.variantId);
            return !v || v.priceIdr !== input.expectedPrices[i.variantId];
          })
          .map((i) => i.variantId);
        if (priceChanged.length) return { ok: false, reason: 'price_changed', variantIds: priceChanged };

        // FR-08-05: reservasi atomik — semua item harus tersedia, atau tidak ada yang direservasi
        const short = input.items
          .filter((i) => getAvailableStock(i.variantId) < i.qty)
          .map((i) => i.variantId);
        if (short.length) return { ok: false, reason: 'out_of_stock', variantIds: short };

        const items = input.items.map((i) => {
          const p = products.find((x) => x.id === i.productId)!;
          const v = findVariant(i.variantId)!;
          return {
            productId: p.id,
            variantId: v.id,
            name: p.name,
            variantLabel: v.label,
            image: p.media[0]?.src ?? '',
            qty: i.qty,
            unitPriceIdr: v.priceIdr,
          };
        });
        const subtotal = items.reduce((s, i) => s + i.unitPriceIdr * i.qty, 0);
        const createdAt = nowIso();

        const order: Order = {
          id: `ord-${Date.now()}`,
          number: orderNumber(),
          userId: input.userId,
          type: 'ready_stock',
          status: 'awaiting_payment',
          paymentStatus: 'unpaid',
          paymentMethod: input.paymentMethod,
          currency: input.currency,
          lockedRate: input.currency === 'USD' ? { usdToIdr: input.usdToIdr, at: createdAt } : undefined,
          items,
          costs: computeCostBreakdown(subtotal, input.shippingService.costIdr),
          // FR-02-05: snapshot alamat — perubahan buku alamat tidak memengaruhi order
          addressSnapshot: { ...input.address },
          shippingService: { ...input.shippingService },
          termsVersion: TERMS_VERSION,
          createdAt,
          reservationExpiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString(),
          history: [{ status: 'awaiting_payment', paymentStatus: 'unpaid', at: createdAt }],
        };

        set((s) => ({ orders: [order, ...s.orders] }));
        return { ok: true, order };
      },

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
 * Stok publik tersedia = stok master − (reservasi aktif + stok yang sudah terjual).
 * Tidak pernah negatif (FR-08-05). Order cancelled melepas stok (AC-08-04).
 */
export function getAvailableStock(variantId: string): number {
  const base = findVariant(variantId)?.stock ?? 0;
  const now = Date.now();
  const used = useOrderStore
    .getState()
    .orders.filter(
      (o) =>
        STOCK_COMMITTED.includes(o.status) ||
        (ACTIVE_RESERVATION.includes(o.status) && new Date(o.reservationExpiresAt).getTime() > now),
    )
    .flatMap((o) => o.items)
    .filter((i) => i.variantId === variantId)
    .reduce((s, i) => s + i.qty, 0);
  return Math.max(0, base - used);
}

/** Aksi yang valid untuk status saat ini (FR-18-04). */
export function canPay(order: Order): boolean {
  return (
    order.status === 'awaiting_payment' &&
    order.paymentStatus !== 'pending' &&
    new Date(order.reservationExpiresAt).getTime() > Date.now()
  );
}
