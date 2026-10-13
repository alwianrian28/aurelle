/**
 * Tipe domain frontend — diturunkan dari PRD v2.0 §10 (entitas tingkat produk).
 * Ini adalah kontrak data sementara untuk mock; skema fisik final ada di dokumen teknis.
 */

export type Locale = 'id' | 'en';
export type Currency = 'IDR' | 'USD';

/** Teks bilingual (ContentTranslation, FR-03-01). */
export type I18nText = Record<Locale, string>;

export type Category = 'ring' | 'bracelet' | 'necklace' | 'earring';

/** Tipe penjualan (FR-04-01, FR-04-08). */
export type SaleType = 'ready_stock' | 'po';

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
  /** Estimasi PO hanya tampil jika diisi admin (FR-04-07). */
  poEstimate?: I18nText;
  featured: boolean;        // produk unggulan → viewer 3D (BR-30)
  active: boolean;
  media: Media[];
  variants: Variant[];
  /** Bentuk model 3D prosedural untuk produk unggulan. */
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
  phoneCountryCode?: string;
  phone?: string;
  preferredLocale: Locale;
  preferredCurrency: Currency;
  newsletter: boolean;
}

export interface ShippingService {
  id: string;
  courier: string;
  name: I18nText;
  etaDays: string;
  costIdr: number;
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

export interface Order {
  id: string;
  number: string;
  /** Pemilik order — pembatasan akses berdasar kepemilikan (FR-18-01). */
  userId: string;
  type: 'ready_stock' | 'po' | 'custom';
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
  /** Timeline status pengerjaan & pembayaran terpisah (FR-18-03). */
  history: OrderStatusEvent[];
}

/* ------------------------------------------------------------------ */
/* F-09 Pengajuan PO/Custom                                            */
/* ------------------------------------------------------------------ */

/**
 * Status pengajuan — subset awal state machine §8.2.
 * Status setelah `awaiting_agreement` dikelola lewat quote/order (F-10+).
 */
export type CustomRequestStatus =
  | 'submitted'
  | 'in_consultation'
  | 'awaiting_agreement'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type RequestKind = 'po' | 'custom';

export interface CustomRequest {
  id: string;
  /** Nomor pengajuan — satu-satunya identitas yang boleh masuk ke URL WhatsApp (FR-09-03). */
  number: string;
  userId: string;
  kind: RequestKind;
  category: Category;
  /** Referensi produk katalog (FR-09-02, AC-09-04). */
  productRef?: { productId: string; slug: string; name: I18nText };
  designReference: string;
  material: string;
  size: string;
  engraving: string;
  /** Anggaran opsional dalam mata uang pilihan pelanggan; tanpa minimum (BR-31). */
  budget?: { amount: number; currency: Currency };
  quantity: number;
  addressSnapshot: Address;
  notes: string;
  status: CustomRequestStatus;
  createdAt: string;
  history: { status: CustomRequestStatus; at: string }[];
}

/* ------------------------------------------------------------------ */
/* F-06 Newsletter                                                     */
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

