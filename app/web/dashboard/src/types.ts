/** Shapes returned by the Aurelle API that the dashboard reads. */
export type Category = 'ring' | 'necklace' | 'bracelet' | 'earring';
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'preparing' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled' | 'pending_decision';
export interface Text2 { id: string; en: string }

export interface User { id: string; email: string; username: string; role: 'customer' | 'admin' }
export interface TrackingPoint { id: number; label: string; note: string; lat: number; lng: number; at: string }

export interface AdminOrder {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: { variantId: string; name: Text2; variantLabel?: { id?: string; en?: string }; image?: string; qty: number; unitPriceIdr: number }[];
  costs: { subtotal: number; tax: number; shipping: number; duty: number; other: number; total: number };
  addressSnapshot: Record<string, string | undefined>;
  shippingService?: { courier: string; name: Text2; etaDays: string; biteship?: { courier: string; service: string } };
  tracking: {
    courier: string | null; trackingNumber: string | null; points: TrackingPoint[];
    /** From the courier, once a shipment is booked at Biteship: the latest status and the courier's tracking page. */
    status?: string | null; link?: string | null; updatedAt?: string | null;
  };
  /** The shipment booked at Biteship, or (with no `orderId`) why the automatic booking failed. */
  biteship?: { orderId: string | null; trackingId: string | null; courier: string | null; service: string | null; priceIdr: number | null; insuranceIdr: number | null; reference: string | null; error: string | null };
  history: { status: OrderStatus; paymentStatus: string; at: string; actor?: string }[];
  customer: { email: string; name: string; phone: string | null } | null;
  nextStatuses: OrderStatus[];
}

/** A courier service and what it charges for one order's parcel. */
export interface CourierRate { courier: string; courierName: string; service: string; serviceName: string; description: string; priceIdr: number; insuranceIdr: number; eta: string; etaUnit: string; collection: string[] }
/** Read from Biteship when asked for, never stored: the courier's scans and the driver. */
export interface CourierTracking {
  status: string | null; link: string | null; trackingNumber: string | null;
  history: { status: string; note: string; at: string }[];
  driver: { name: string; phone: string | null; plateNumber: string | null; photoUrl: string | null } | null;
}

export interface AdminVariant { id: string; sku: string; label: Text2; priceIdr: number; available: number; held: number; sold: number }
export interface AdminProduct {
  id: string;
  slug: string;
  name: Text2;
  description: Text2;
  materials: Text2;
  category: Category;
  thumb: string | null;
  media: string[];
  collectionIds: string[];
  active: boolean;
  variants: AdminVariant[];
}

export interface Collection { id: string; slug: string; name: Text2; story: Text2; banner: string; active: boolean; productIds: string[] }
/** What every catalog write answers with: the whole catalog as it now stands. */
export interface Catalog { products: AdminProduct[]; collections: Collection[] }
export type SetCatalog = (catalog: Catalog) => void;

export interface Customer {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  phone: string | null;
  orders: number;
  paidIdr: number;
  lastOrderAt: string | null;
}

export interface OverviewData {
  today: { orders: number; paidIdr: number };
  period: { days: number; orders: number; paidOrders: number; paidIdr: number };
  awaitingPayment: number;
  awaitingPaymentIdr: number;
  toProcess: number;
  shipped: number;
  customers: number;
  daily: { date: string; orders: number; paidIdr: number }[];
  lowStock: { sku: string; productId: string; product: string; variant: string; available: number }[];
  lowStockTotal: number;
  soldOutTotal: number;
  topProducts: { productId: string; product: string; thumb: string | null; qty: number }[];
  latestOrders: { id: string; number: string; customer: string | null; status: OrderStatus; paymentStatus: string; totalIdr: number; createdAt: string }[];
}

export interface StoreSettings {
  usdToIdr: number;
  servedCountries: string[];
  reservationMinutes: number;
  shippingServices: { id: string; courier: string; name: Text2; etaDays: string; costIdr: number }[];
}

/** Where the dashboard is: a section, plus the record open in it or a search carried over. */
export interface Route { view: 'overview' | 'orders' | 'customers' | 'products' | 'collections' | 'settings'; id?: string; q?: string; tab?: string }
export type Go = (route: Route) => void;
