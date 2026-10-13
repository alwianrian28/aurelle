import type { Collection, CurrencyRate, Product, ShippingService } from '../types/domain';

/**
 * Mock data katalog — pengganti sementara backend Express (§10 PRD).
 * Nama, harga, dan stok adalah data contoh, bukan katalog final.
 */

export const currencyRate: CurrencyRate = {
  usdToIdr: 15800,
  source: 'mock-static',
  effectiveAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

export const shippingServices: ShippingService[] = [
  {
    id: 'ship-standard',
    courier: 'DHL',
    name: { id: 'Standar Internasional', en: 'International Standard' },
    etaDays: '7–12',
    costIdr: 285000,
  },
  {
    id: 'ship-express',
    courier: 'FedEx',
    name: { id: 'Ekspres Internasional', en: 'International Express' },
    etaDays: '3–5',
    costIdr: 540000,
  },
];

export const collections: Collection[] = [
  {
    id: 'col-aurora',
    slug: 'aurora-heritage',
    name: { id: 'Aurora Heritage', en: 'Aurora Heritage' },
    story: {
      id: 'Siluet klasik yang dihidupkan kembali dengan sentuhan kontemporer — garis bersih, proporsi presisi, dan kilau silver yang tenang.',
      en: 'Classic silhouettes reimagined with a contemporary touch — clean lines, precise proportions, and a quiet silver glow.',
    },
    banner: '/media/collections/aurora.jpg',
    productIds: ['ring-aria', 'necklace-lumen', 'earring-celeste'],
  },
  {
    id: 'col-noir',
    slug: 'noir-mineral',
    name: { id: 'Noir Mineral', en: 'Noir Mineral' },
    story: {
      id: 'Material campuran dan batu alami bertekstur gelap, dirancang untuk yang menyukai keanggunan yang lebih berani.',
      en: 'Mixed materials and dark-toned natural stones, designed for those who favor a bolder elegance.',
    },
    banner: '/media/collections/noir.jpg',
    productIds: ['bracelet-mira', 'ring-ombra'],
  },
];

export const products: Product[] = [
  {
    id: 'ring-aria',
    slug: 'aria-solitaire-ring',
    name: { id: 'Cincin Aria Solitaire', en: 'Aria Solitaire Ring' },
    tagline: { id: 'Kemilau tunggal yang abadi', en: 'A single, timeless glow' },
    description: {
      id: 'Cincin solitaire dengan tampilan logam silver, dirancang untuk kilau maksimal dengan siluet minimal.',
      en: 'A solitaire ring in silver-colored metal, engineered for maximum sparkle with a minimal silhouette.',
    },
    category: 'ring',
    collectionIds: ['col-aurora'],
    saleType: 'ready_stock',
    materials: { id: 'Tampilan silver · material demo belum terverifikasi', en: 'Silver appearance · demo material not yet verified' },
    stoneType: { id: 'Zirkonia kubik', en: 'Cubic zirconia' },
    engravingAvailable: false,
    featured: true,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/ring-aria-1.jpg', alt: { id: 'Cincin Aria tampak depan', en: 'Aria ring front view' } },
      { id: 'm2', src: '/media/products/ring-aria-2.jpg', alt: { id: 'Cincin Aria tampak samping', en: 'Aria ring side view' } },
    ],
    variants: [
      { id: 'v-ring-aria-7', sku: 'RNG-ARIA-07', label: { id: 'Ukuran 7', en: 'Size 7' }, size: '7', priceIdr: 3250000, stock: 6 },
      { id: 'v-ring-aria-8', sku: 'RNG-ARIA-08', label: { id: 'Ukuran 8', en: 'Size 8' }, size: '8', priceIdr: 3250000, stock: 0 },
    ],
    model3d: 'ring',
    createdAt: '2026-08-01',
  },
  {
    id: 'ring-ombra',
    slug: 'ombra-twist-ring',
    name: { id: 'Cincin Ombra Twist', en: 'Ombra Twist Ring' },
    tagline: { id: 'Lekukan berani, kilau lembut', en: 'Bold curves, soft shine' },
    description: {
      id: 'Desain twist asimetris dengan material campuran gelap, cocok dipadukan sendiri atau bertumpuk.',
      en: 'An asymmetric twist design in dark mixed material, perfect worn alone or stacked.',
    },
    category: 'ring',
    collectionIds: ['col-noir'],
    saleType: 'ready_stock',
    materials: { id: 'Tampilan silver · material demo belum terverifikasi', en: 'Silver appearance · demo material not yet verified' },
    engravingAvailable: true,
    featured: false,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/ring-ombra-1.jpg', alt: { id: 'Cincin Ombra', en: 'Ombra ring' } },
      { id: 'm2', src: '/media/products/ring-ombra-2.jpg', alt: { id: 'Cincin Ombra tampak samping', en: 'Ombra ring side view' } },
    ],
    variants: [
      { id: 'v-ring-ombra-7', sku: 'RNG-OMB-07', label: { id: 'Ukuran 7', en: 'Size 7' }, size: '7', priceIdr: 2650000, stock: 4 },
    ],
    model3d: 'band',
    createdAt: '2026-07-20',
  },
  {
    id: 'bracelet-mira',
    slug: 'mira-chain-bracelet',
    name: { id: 'Gelang Rantai Mira', en: 'Mira Chain Bracelet' },
    tagline: { id: 'Elegan dalam setiap tautan', en: 'Elegance in every link' },
    description: {
      id: 'Gelang rantai halus dengan material campuran, nyaman dipakai harian maupun acara formal.',
      en: 'A delicate chain bracelet in mixed material, comfortable for daily wear or formal occasions.',
    },
    category: 'bracelet',
    collectionIds: ['col-noir'],
    saleType: 'ready_stock',
    materials: { id: 'Tampilan silver · material demo belum terverifikasi', en: 'Silver appearance · demo material not yet verified' },
    engravingAvailable: true,
    featured: false,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/bracelet-mira-1.jpg', alt: { id: 'Gelang Mira', en: 'Mira bracelet' } },
      { id: 'm2', src: '/media/products/bracelet-mira-2.jpg', alt: { id: 'Gelang Mira tampak samping', en: 'Mira bracelet side view' } },
    ],
    variants: [
      { id: 'v-bracelet-mira-s', sku: 'BRC-MIRA-S', label: { id: 'Panjang 16cm', en: 'Length 16cm' }, priceIdr: 1850000, stock: 10 },
      { id: 'v-bracelet-mira-m', sku: 'BRC-MIRA-M', label: { id: 'Panjang 18cm', en: 'Length 18cm' }, priceIdr: 1850000, stock: 10 },
    ],
    model3d: 'bangle',
    createdAt: '2026-06-15',
  },
  {
    id: 'necklace-lumen',
    slug: 'lumen-pendant-necklace',
    name: { id: 'Kalung Pendant Lumen', en: 'Lumen Pendant Necklace' },
    tagline: { id: 'Cahaya yang mengikuti gerakmu', en: 'Light that follows your movement' },
    description: {
      id: 'Pendant sculptural dengan tampilan silver dan batu dekoratif, menjadi focal point yang anggun.',
      en: 'A sculptural pendant in silver-colored metal and decorative stone, an elegant focal point.',
    },
    category: 'necklace',
    collectionIds: ['col-aurora'],
    saleType: 'ready_stock',
    materials: { id: 'Tampilan silver · material demo belum terverifikasi', en: 'Silver appearance · demo material not yet verified' },
    stoneType: { id: 'Batu bulan', en: 'Moonstone' },
    engravingAvailable: false,
    featured: true,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/necklace-lumen-1.jpg', alt: { id: 'Kalung Lumen', en: 'Lumen necklace' } },
      { id: 'm2', src: '/media/products/necklace-lumen-2.jpg', alt: { id: 'Detail pendant Lumen', en: 'Lumen pendant detail' } },
    ],
    variants: [
      { id: 'v-necklace-lumen', sku: 'NCK-LUMEN-01', label: { id: 'Panjang 45cm', en: 'Length 45cm' }, priceIdr: 4150000, stock: 3 },
    ],
    model3d: 'pendant',
    createdAt: '2026-08-10',
  },
  {
    id: 'earring-celeste',
    slug: 'celeste-drop-earring',
    name: { id: 'Anting Drop Celeste', en: 'Celeste Drop Earring' },
    tagline: { id: 'Gerakan lembut penuh karakter', en: 'Soft movement, full character' },
    description: {
      id: 'Anting drop sculptural dengan aksen mutiara, ringan dipakai sepanjang hari.',
      en: 'A sculptural drop earring with pearl accent, light enough for all-day wear.',
    },
    category: 'earring',
    collectionIds: ['col-aurora'],
    saleType: 'ready_stock',
    materials: { id: 'Tampilan silver · material demo belum terverifikasi', en: 'Silver appearance · demo material not yet verified' },
    engravingAvailable: false,
    featured: false,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/earring-celeste-1.jpg', alt: { id: 'Anting Celeste', en: 'Celeste earring' } },
      { id: 'm2', src: '/media/products/earring-celeste-2.jpg', alt: { id: 'Anting Celeste tampak samping', en: 'Celeste earring side view' } },
    ],
    variants: [
      { id: 'v-earring-celeste', sku: 'EAR-CEL-01', label: { id: 'Sepasang', en: 'Pair' }, priceIdr: 2250000, stock: 8 },
    ],
    createdAt: '2026-07-01',
  },
  {
    id: 'ring-promise',
    slug: 'promise-custom-ring',
    name: { id: 'Cincin Promise (Desain Katalog PO)', en: 'Promise Ring (Catalog PO Design)' },
    tagline: { id: 'Desain acuan untuk pengajuan PO Anda', en: 'A reference design for your PO request' },
    description: {
      id: 'Desain katalog yang dapat dijadikan referensi pengajuan PO. Material, ukuran, dan engraving disesuaikan melalui konsultasi.',
      en: 'A catalog design that can be used as a PO request reference. Material, size, and engraving are tailored through consultation.',
    },
    category: 'ring',
    collectionIds: [],
    saleType: 'po',
    materials: { id: 'Disesuaikan saat konsultasi', en: 'Customized during consultation' },
    engravingAvailable: true,
    poEstimate: { id: '', en: '' },
    featured: false,
    active: true,
    media: [
      { id: 'm1', src: '/media/products/ring-promise-1.jpg', alt: { id: 'Cincin Promise', en: 'Promise ring' } },
      { id: 'm2', src: '/media/products/ring-promise-2.jpg', alt: { id: 'Cincin Promise tampak atas', en: 'Promise ring top view' } },
    ],
    variants: [
      { id: 'v-ring-promise', sku: 'RNG-PROMISE-01', label: { id: 'Referensi', en: 'Reference' }, priceIdr: 0, stock: 0 },
    ],
    createdAt: '2026-05-01',
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}

export function getProductsByCollection(collectionId: string): Product[] {
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return [];
  // FR-04-09: urutan mengikuti pengaturan admin (productIds), hanya produk aktif (FR-04-03).
  return collection.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p && p.active);
}
