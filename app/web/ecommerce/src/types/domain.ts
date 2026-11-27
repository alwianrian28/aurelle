/**
 * Tipe domain frontend — diturunkan dari PRD v2.0 §10 (entitas tingkat produk).
 * Ini adalah kontrak data sementara untuk mock; skema fisik final ada di dokumen teknis.
 */

export type Locale = 'id' | 'en';
export type Currency = 'IDR' | 'USD';

/** Teks bilingual (ContentTranslation, FR-03-01). */
export type I18nText = Record<Locale, string>;

export type Category = 'ring' | 'bracelet' | 'necklace' | 'earring';

/** Tipe penjualan (FR-04-01). */
export type SaleType = 'ready_stock';

export interface Media {
  id: string;
  src: string;
  alt: I18nText;
}

export interface Variant {
  id: string;
  sku: string;
  label: I18nText;          // mis. "Ukuran 7 · Yellow Gold"
  size?: string;
  color?: I18nText;
  /** Harga basis IDR dalam satuan rupiah utuh (BR-08 [R1]). USD dihitung dari kurs aktif. */
  priceIdr: number;
  /** Stok tersedia publik (tanpa info reservasi internal, AC-04-07). */
  stock: number;
  weightGram?: number;
}

export interface Product {
  id: string;
  slug: string;
  name: I18nText;
  tagline: I18nText;
  description: I18nText;
  category: Category;
  collectionIds: string[];
  saleType: SaleType;
  materials: I18nText;
  stoneType?: I18nText;
  dimensions?: I18nText;
  engravingAvailable: boolean;
  featured: boolean;        // produk unggulan → viewer 3D (BR-30)
  active: boolean;
  media: Media[];
  variants: Variant[];
  /** Bentuk model 3D prosedural untuk produk unggulan. */
  jewelryModel?: string;
  model3d?: 'ring' | 'band' | 'bangle' | 'pendant' | 'hoop';
  createdAt: string;
}

export interface Collection {
  id: string;
  slug: string;
  name: I18nText;
  story: I18nText;
  banner: string;
  productIds: string[];
}

export interface CurrencyRate {
  /** Nilai 1 USD dalam IDR. */
  usdToIdr: number;
  source: string;
  effectiveAt: string;
  /** Batas kedaluwarsa kurs (FR-03 alt flow). */
  expiresAt: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  qty: number;
  /** Harga IDR saat item ditambahkan; dipakai untuk mendeteksi perubahan harga (FR-07-03). */
  priceIdrAtAdd: number;
}

export interface Address {
  id: string;
  recipient: string;
  phoneCountryCode: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  line1: string;
  line2?: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  provider: 'google' | 'email';
  /** Set by the API; 'admin' unlocks the order desk (enforced server-side). */
  role?: 'customer' | 'admin';
  phoneCountryCode?: string | null;
  phone?: string | null;
  preferredLocale: Locale;
  preferredCurrency: Currency;
  newsletter: boolean;
  /** When the account was created (ISO), for "Member since". */
  createdAt?: string;
}

export interface ShippingService {
  id: string;
  courier: string;
  name: I18nText;
  etaDays: string;
  costIdr: number;
  /** The part of `costIdr` that insures the goods, for a live courier rate. */
  insuranceIdr?: number;
  /** Set when the service is a live courier rate (Biteship) rather than one from the store's list. */
  biteship?: { courier: string; service: string };
}

/** Rincian biaya ready stock (BR-15, FR-08-03). */
export interface CostBreakdown {
  subtotal: number;
  tax: number;
  shipping: number;
  duty: number;
  other: number;
  total: number;
}

export type ReadyStockOrderStatus =
  | 'awaiting_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'pending_decision';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'partial'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'review_finance'
  | 'refund_pending'
  | 'refunded';

export interface OrderItemSnapshot {
  productId: string;
  variantId: string;
  name: I18nText;
  variantLabel: I18nText;
  image: string;
  qty: number;
  unitPriceIdr: number;
}

/** Metode bayar (BR-09). Ketersediaan per mata uang bergantung provider (OD-11). */
export type PaymentMethod = 'card' | 'qris';

export interface OrderStatusEvent {
  status: ReadyStockOrderStatus;
  paymentStatus: PaymentStatus;
  at: string;
}

export interface TrackingPoint {
  id: number;
  label: string;
  note: string;
  lat: number;
  lng: number;
  at: string;
}

export interface OrderTracking {
  courier: string | null;
  trackingNumber: string | null;
  points: TrackingPoint[];
  /** From the courier, once a shipment is booked: the latest status and the courier's tracking page. */
  status?: string | null;
  link?: string | null;
  updatedAt?: string | null;
  /** Only in the answers of GET /orders/{id}/tracking and POST /orders/track: the courier's scans. */
  history?: { status: string; note: string; at: string }[];
  /** The lookup by order number and email gives the name only. */
  driver?: { name: string; phone?: string | null; plateNumber?: string | null; photoUrl?: string | null } | null;
  map?: ShipmentMapData | null;
}

export type ShipmentTone = 'normal' | 'gray' | 'orange' | 'green' | 'purple' | 'red';
type LatLng = { lat: number; lng: number };

/**
 * Where a parcel is drawn between the store and the customer's area. The position is an
 * estimate from the courier's status and the time, never a GPS reading; the destination is the
 * middle of a district or city, never the address. Any of the points can be missing.
 */
export interface ShipmentMapData {
  estimated: true;
  /** The courier's status as Biteship names it, e.g. `in_transit`. */
  status: string;
  stage: 1 | 2 | 3 | 4 | 5;
  tone: ShipmentTone;
  /** 0 = at the store, 1 = at the customer. */
  progress: number;
  returning: boolean;
  etaAt: string | null;
  origin: LatLng | null;
  destination: (LatLng & { precision: 'district' | 'city'; city: string }) | null;
  /** `straight`: no road joins the two (another island, air freight); drawn as a dashed line. */
  route: { kind: 'road' | 'straight'; distanceKm: number; passed: [number, number][]; remaining: [number, number][] } | null;
  vehicle: LatLng | null;
}

export interface Order {
  id: string;
  number: string;
  /** Pemilik order — pembatasan akses berdasar kepemilikan (FR-18-01). */
  userId: string;
  type: 'ready_stock';
  status: ReadyStockOrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currency: Currency;
  /** Kurs dikunci saat order dibuat (FR-08-06). */
  lockedRate?: { usdToIdr: number; at: string };
  items: OrderItemSnapshot[];
  /** Nominal dalam IDR (basis); tampilan USD memakai lockedRate. */
  costs: CostBreakdown;
  addressSnapshot: Address;
  shippingService: ShippingService;
  termsVersion: string;
  createdAt: string;
  reservationExpiresAt: string;
  cancelReason?: 'payment_expired';
  /** Shipment tracking kept by the API (courier, AWB, map checkpoints). */
  tracking?: OrderTracking;
  updatedAt?: string;
  /** Timeline status pengerjaan & pembayaran terpisah (FR-18-03). */
  history: OrderStatusEvent[];
}

/**
 * What the Track order page shows. The public lookup (order number + email, no login)
 * returns exactly this: no street address, phone, prices or account ids.
 */
export interface TrackedOrder {
  /** Only set for the signed-in customer's own orders, to link to the full detail page. */
  id?: string;
  number: string;
  status: ReadyStockOrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
  cancelReason?: 'payment_expired' | null;
  history: OrderStatusEvent[];
  tracking?: OrderTracking;
  items: Pick<OrderItemSnapshot, 'name' | 'variantLabel' | 'image' | 'qty'>[];
  shippingService: Pick<ShippingService, 'courier' | 'name' | 'etaDays'>;
  destination: { city: string; country: string };
}

/* ------------------------------------------------------------------ */
/* F-06 Newsletter                                                    */
/* ------------------------------------------------------------------ */

export type SubscriberStatus = 'pending_confirmation' | 'active' | 'unsubscribed';

export interface NewsletterSubscriber {
  email: string;
  status: SubscriberStatus;
  locale: Locale;
  /** Sumber pendaftaran (FR-06-04). */
  source: 'footer' | 'home' | 'account';
  consentAt: string;
  consentVersion: string;
}

