/** Shapes returned by the Aurelle API that the dashboard reads. */
export type Category = 'ring' | 'necklace' | 'bracelet' | 'earring';
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'preparing' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled' | 'pending_decision';

export interface User { id: string; email: string; username: string; role: 'customer' | 'admin' }
export interface TrackingPoint { id: number; label: string; note: string; lat: number; lng: number; at: string }

export interface AdminOrder {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  items: { variantId: string; name: { id: string; en: string }; variantLabel?: { id?: string; en?: string }; qty: number; unitPriceIdr: number }[];
  costs: { subtotal: number; tax: number; shipping: number; duty: number; other: number; total: number };
  addressSnapshot: Record<string, string | undefined>;
  tracking: { courier: string | null; trackingNumber: string | null; points: TrackingPoint[] };
  history: { status: OrderStatus; paymentStatus: string; at: string; actor?: string }[];
  customer: { email: string; name: string; phone: string | null } | null;
  nextStatuses: OrderStatus[];
}
