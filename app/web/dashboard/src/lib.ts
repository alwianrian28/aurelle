import type { AdminOrder, AdminProduct, Category, OrderStatus } from './types';

/* ------------------------------------------------------------- formatting */

export const idr = (n: number) => `Rp ${n.toLocaleString('en-US')}`;
/** Compact rupiah for tiles and bar labels: Rp 9.33 jt / Rp 850 rb. */
export const idrShort = (n: number) => {
  const cut = (v: number, unit: string) => `Rp ${v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2 })} ${unit}`;
  return n >= 1e9 ? cut(n / 1e9, 'M') : n >= 1e6 ? cut(n / 1e6, 'jt') : n >= 1e3 ? cut(n / 1e3, 'rb') : `Rp ${n}`;
};
export const dateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return min < 1 ? 'now' : min < 60 ? `${min}m` : min < 1440 ? `${Math.round(min / 60)}h` : `${Math.round(min / 1440)}d`;
};
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Product photos are served by the shop, not by the dashboard. */
const SHOP_URL: string = import.meta.env.VITE_SHOP_URL ?? 'http://localhost:5173/store';
export const shopUrl = SHOP_URL;
/** Uploads (/api/media/…) come from the API this dashboard already talks to; the rest is the shop's. */
export const media = (src: string) => (/^https?:/.test(src) || src.startsWith('/api/') ? src : new URL(src, SHOP_URL).href);

/** A photo is a link: an upload, a file the shop serves under /media, or any https address (same rule as the API). */
export const isMediaSrc = (text: string) => /^(https:\/\/|\/media\/|\/api\/media\/)[^"<>\\\n\r\t]+$/.test(text) && text.length <= 500;
/** What the API's refusals mean, in words for the person at the dashboard. */
export const SAVE_ERROR: Record<string, string> = {
  sku_taken: 'That SKU is already used by another variant.',
  variant_in_orders: 'This variant is on existing orders, so it cannot be removed. Set its stock to 0 instead.',
  last_variant: 'A product needs at least one variant.',
  last_service: 'The store needs at least one shipping service.',
  invalid_input: 'Some values are missing or not valid. Check the form and try again.',
  conflict: 'That name was just taken. Try again.',
  network: 'Could not reach the server.',
  wrong_password: 'The current password is not right.',
  too_many_attempts: 'Too many attempts. Wait a minute, then try again.',
  unauthenticated: 'You are signed out. Reload the page and sign in again.',
  too_large: 'That photo is too large, even after shrinking. Try a smaller one.',
  not_an_image: 'That file is not a JPEG, PNG or WebP photo.',
};
export const saveError = (code: string) => SAVE_ERROR[code] ?? 'Could not save. Try again.';

export const CATEGORY: Record<Category, string> = { ring: 'Ring', necklace: 'Necklace', bracelet: 'Bracelet', earring: 'Earrings' };
export const CATEGORY_PLURAL: Record<Category, string> = { ring: 'Rings', necklace: 'Necklaces', bracelet: 'Bracelets', earring: 'Earrings' };

/* ----------------------------------------------------------- order states */

export const STATUS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', preparing: 'Preparing', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', pending_decision: 'Needs decision',
};
export const PAYMENT: Record<string, string> = {
  unpaid: 'Awaiting payment', pending: 'Awaiting confirmation', partial: 'Partial', paid: 'Paid', failed: 'Failed',
  expired: 'Expired', review_finance: 'Finance review', refund_pending: 'Refund in progress', refunded: 'Refunded',
};
/** What an admin's next step is called on a button. */
/** Where the parcel is, in the dashboard's words. Empty while the order still waits for payment. */
export const fulfillment = (status: OrderStatus) => (status === 'awaiting_payment' ? '' : status === 'confirmed' ? 'To ship' : status === 'preparing' ? 'Packing' : STATUS[status]);
export const ACTION: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order', preparing: 'Start packing', ready_to_ship: 'Mark ready to ship', shipped: 'Mark as shipped', delivered: 'Mark as delivered', cancelled: 'Cancel order',
};

export type Tone = 'green' | 'amber' | 'blue' | 'red' | 'grey';
export type Stage = 'awaiting' | 'toship' | 'shipped' | 'delivered' | 'cancelled';
export const stageOf = (status: OrderStatus): Stage =>
  status === 'awaiting_payment' || status === 'pending_decision' ? 'awaiting'
    : status === 'shipped' || status === 'delivered' || status === 'cancelled' ? status : 'toship';


/** Stock state of a product, worst case first. */
export function stockState(p: AdminProduct): { tone: Tone; label: string; restock: boolean } {
  const out = p.variants.filter((v) => v.available === 0);
  if (p.variants.length > 0 && out.length === p.variants.length) return { tone: 'red', label: 'Sold out', restock: true };
  if (out.length === 1) return { tone: 'red', label: `${out[0].label.en} sold out`, restock: true };
  if (out.length > 1) return { tone: 'red', label: `${out.length} variants sold out`, restock: true };
  if (p.variants.some((v) => v.available <= 2)) return { tone: 'amber', label: 'Low stock', restock: false };
  return { tone: 'green', label: 'In stock', restock: false };
}

/** "Size 7", "Size 8" → "Size 7, 8"; "16 cm", "18 cm" → "16, 18 cm". */
export function variantSummary(p: AdminProduct): string {
  const parts = p.variants.map((v) => v.label.en.split(' '));
  if (parts.length > 1 && parts.every((x) => x.length === 2)) {
    if (parts.every((x) => x[0] === parts[0][0])) return `${parts[0][0]} ${parts.map((x) => x[1]).join(', ')}`;
    if (parts.every((x) => x[1] === parts[0][1])) return `${parts.map((x) => x[0]).join(', ')} ${parts[0][1]}`;
  }
  return p.variants.map((v) => v.label.en).join(', ');
}

/** Rows per page: 10 to start with, and what the list footer lets the admin choose. */
export const PAGE = 10;
export const PAGE_SIZES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/* ---------------------------------------------------------------- exports */

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Opens a printable packing slip: where it goes and what is in the parcel. No prices. */
export function printPackingSlip(o: AdminOrder) {
  const a = o.addressSnapshot;
  const address = [a.recipient, a.line1, a.line2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.country, [a.phoneCountryCode, a.phone].filter(Boolean).join(' ')].filter(Boolean) as string[];
  const rows = o.items.map((i) => `<tr><td>${esc(i.name.en)}<br><small>${esc(i.variantLabel?.en ?? '')}</small></td><td class="q">${i.qty}</td><td class="q">☐</td></tr>`).join('');
  const html = `<!doctype html><title>Packing slip ${esc(o.number)}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#151922;margin:40px;max-width:640px}h1{font-size:20px;letter-spacing:.2em;margin:0 0 24px}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#555f6d;margin:24px 0 6px}
    table{width:100%;border-collapse:collapse}td,th{padding:8px 0;border-bottom:1px solid #d5d9e0;text-align:left;vertical-align:top}.q{width:70px;text-align:center}small{color:#555f6d}
  </style><h1>AURELLE</h1><p><strong>Packing slip · ${esc(o.number)}</strong><br>${esc(dateTime(o.createdAt))}${o.shippingService ? ` · ${esc(o.shippingService.courier)} ${esc(o.shippingService.name.en)}` : ''}</p>
  <h2>Ship to</h2><p>${address.map(esc).join('<br>')}</p>
  <h2>Items</h2><table><tr><th>Item</th><th class="q">Qty</th><th class="q">Packed</th></tr>${rows}</table>`;
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

/* ------------------------------------------------------------------ clock */

export const todayLong = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
/** Start of a date filter, in epoch milliseconds: today's midnight, N days back, or the beginning. */
/** A calendar day (YYYY-MM-DD) in the admin's own time zone, as date inputs read and write it. */
export const dayOf = (daysAgo = 0) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** First and last millisecond of a calendar day, local time. */
export const dayBounds = (day: string): [number, number] => [new Date(`${day}T00:00:00`).getTime(), new Date(`${day}T23:59:59.999`).getTime()];
export const rangeStart = (range: string) => (range === 'all' ? 0 : range === 'today' ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(range) * 86_400_000);

/* --------------------------------------------------------------- variants */

/** A variant as typed into a form, before it is sent. Price and stock hold digits only. */
export interface VariantDraft { label: string; sku: string; price: string; available: string }
export const emptyVariant = (): VariantDraft => ({ label: '', sku: '', price: '', available: '0' });
export const digits = (text: string) => text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
export const grouped = (text: string) => (text === '' ? '' : Number(text).toLocaleString('id-ID'));
/** Which fields of a variant draft the API would refuse. */
export const variantProblems = (v: VariantDraft) => ({
  label: v.label.trim().length < 1,
  sku: !/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(v.sku.trim()),
  price: v.price === '' || Number(v.price) < 1,
  available: v.available === '' || Number(v.available) > 100_000,
});
export const variantOk = (v: VariantDraft) => !Object.values(variantProblems(v)).some(Boolean);
export const variantBody = (v: VariantDraft) => ({ labelEn: v.label.trim(), sku: v.sku.trim(), priceIdr: Number(v.price), available: Number(v.available) });

/* ----------------------------------------------------------------- photos */

const LONGEST_SIDE = 1600;
const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Shrinks a photo before it is uploaded: at most 1600 px on its longest side, saved as WebP
 * (JPEG where the browser cannot write WebP). A phone photo of several megabytes becomes a
 * few hundred kilobytes, which is what the shop needs and what the API accepts.
 * Throws when the file is not an image the browser can read.
 */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = await toBlob(canvas, 'image/webp', 0.86);
    if (webp?.type === 'image/webp') return webp;
    // JPEG has no transparency: put the picture on white instead of black.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.88);
    if (!jpeg) throw new Error('no encoder');
    return jpeg;
  } finally {
    bitmap.close();
  }
}
