import type { I18nText } from '../types/domain';

/**
 * Customer-service content: consultation card, size guide, care guide and trust points.
 * Shared by the storefront, the footer dialogs and the /guides pages.
 * Brand claims marked PENDING below must be confirmed before launch (PRD §14).
 */

/* ------------------------------------------------------------------ */
/* Consultation                                                         */
/* ------------------------------------------------------------------ */

export const consultCopy = {
  eyebrow: { id: 'Konsultasi personal', en: 'Personal advice' },
  title: { id: 'Butuh bantuan memilih?', en: 'Need help choosing?' },
  body: {
    id: 'Ngobrol dengan tim kami sebelum membeli. Kami bantu memilih perhiasan dan ukuran yang tepat.',
    en: 'Chat with our team before you buy. We’ll help you pick the right piece and the right size.',
  },
  cta: { id: 'Chat via WhatsApp', en: 'Chat on WhatsApp' },
  available: { id: 'Tersedia', en: 'Available' },
  message: { id: 'Halo Aurelle, saya butuh bantuan memilih perhiasan.', en: 'Hello Aurelle, I would like help choosing a piece.' },
} satisfies Record<string, I18nText>;

/* ------------------------------------------------------------------ */
/* Size guide                                                           */
/* ------------------------------------------------------------------ */

export const sizeGuideCopy = {
  eyebrow: { id: 'Panduan ukuran', en: 'Size guide' },
  title: { id: 'Temukan ukuran yang pas', en: 'Find your perfect size' },
  body: { id: 'Ukur ukuran cincin Anda di rumah dalam tiga langkah mudah.', en: 'Measure your ring size at home in three simple steps.' },
  openChart: { id: 'Buka tabel ukuran', en: 'Open size chart' },
  careLink: { id: 'Panduan perawatan', en: 'Care guide' },
  chartTitle: { id: 'Tabel ukuran', en: 'Size chart' },
  tipLabel: { id: 'Tips:', en: 'Tip:' },
  unsure: { id: 'Masih ragu? Chat dengan kami via WhatsApp', en: 'Still unsure? Chat with us on WhatsApp' },
  message: { id: 'Halo Aurelle, saya butuh bantuan menentukan ukuran.', en: 'Hello Aurelle, I need help finding my size.' },
};

/** The three-step ring method shown in the size chart dialog. */
export const ringMeasureSteps: I18nText[] = [
  { id: 'Lilitkan secarik kertas di pangkal jari Anda.', en: 'Wrap a strip of paper around the base of your finger.' },
  { id: 'Tandai titik pertemuannya, lalu ukur panjangnya dalam mm.', en: 'Mark where it overlaps and measure the length in mm.' },
  { id: 'Cocokkan angka itu dengan tabel ukuran kami.', en: 'Match that number to our size chart.' },
];

export type SizeKind = 'ring' | 'bracelet';

export const sizeChart: Record<SizeKind, {
  tab: I18nText;
  howTitle: I18nText;
  steps: I18nText[];
  tip: I18nText;
  note: I18nText;
  columns: [I18nText, I18nText, I18nText];
  rows: [string, string, string][];
}> = {
  ring: {
    tab: { id: 'Cincin', en: 'Rings' },
    howTitle: { id: 'Cara mengukur jari', en: 'How to measure your finger' },
    steps: [
      ringMeasureSteps[0],
      ringMeasureSteps[1],
      { id: 'Cari keliling terdekat di tabel.', en: 'Find the closest circumference in the chart.' },
    ],
    tip: {
      id: 'Ukur di sore atau malam hari, saat jari paling besar. Di antara dua ukuran? Pilih yang lebih besar.',
      en: 'Measure at the end of the day, when fingers are at their largest. Between two sizes? Choose the larger one.',
    },
    note: { id: 'Ukuran cincin standar US.', en: 'Standard US ring sizes.' },
    columns: [
      { id: 'Ukuran (US)', en: 'Size (US)' },
      { id: 'Keliling (mm)', en: 'Circumference (mm)' },
      { id: 'Diameter (mm)', en: 'Diameter (mm)' },
    ],
    // Standard US conversion data, not a brand claim.
    rows: [
      ['5', '49.3', '15.7'], ['5½', '50.6', '16.1'], ['6', '51.9', '16.5'], ['6½', '53.1', '16.9'],
      ['7', '54.4', '17.3'], ['7½', '55.7', '17.7'], ['8', '57.0', '18.1'], ['8½', '58.3', '18.5'],
      ['9', '59.5', '18.9'], ['9½', '60.8', '19.4'], ['10', '62.1', '19.8'],
    ],
  },
  bracelet: {
    tab: { id: 'Gelang', en: 'Bracelets' },
    howTitle: { id: 'Cara mengukur pergelangan', en: 'How to measure your wrist' },
    steps: [
      { id: 'Lilitkan pita ukur atau secarik kertas tepat di atas tulang pergelangan.', en: 'Wrap a soft tape or strip of paper just above your wrist bone.' },
      { id: 'Tandai titik pertemuannya, lalu ukur panjangnya dalam cm.', en: 'Mark where it overlaps and measure the length in cm.' },
      { id: 'Cari lingkar pergelangan terdekat di tabel.', en: 'Find the closest wrist size in the chart.' },
    ],
    tip: {
      id: 'Suka lebih longgar? Tambahkan 0,5 cm. Untuk bangle kaku, pastikan muat melewati buku tangan.',
      en: 'Prefer a looser fit? Add 0.5 cm. For rigid bangles, make sure it slips over your knuckles.',
    },
    note: { id: 'Panduan umum: panjang gelang ±1,5-2 cm lebih dari lingkar pergelangan.', en: 'General guide: bracelet length is about 1.5-2 cm more than your wrist.' },
    columns: [
      { id: 'Ukuran', en: 'Size' },
      { id: 'Pergelangan (cm)', en: 'Wrist (cm)' },
      { id: 'Panjang gelang (cm)', en: 'Bracelet length (cm)' },
    ],
    rows: [
      ['XS', '13-14', '15.5'], ['S', '14-15', '16.5'], ['M', '15-16', '17.5'], ['L', '16-17', '18.5'], ['XL', '17-18', '19.5'],
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Care guide                                                           */
/* ------------------------------------------------------------------ */

export type CareIcon = 'wearing' | 'cleaning' | 'storing';

export const careGuide = {
  eyebrow: { id: 'Panduan perawatan', en: 'Care guide' },
  title: { id: 'Jaga kilau perhiasan Anda', en: 'Keep your pieces shining' },
  body: { id: 'Beberapa kebiasaan sederhana menjaga perhiasan Anda tetap indah bertahun-tahun.', en: 'A few simple habits help your jewelry look its best for years.' },
  groups: [
    {
      icon: 'wearing' as CareIcon,
      label: { id: '01 · Kebiasaan harian', en: '01 · Daily habits' },
      title: { id: 'Saat dipakai', en: 'Wearing' },
      tips: [
        { id: 'Pakai perhiasan paling akhir, setelah parfum, lotion, dan hairspray.', en: 'Put jewelry on last, after perfume, lotion and hairspray.' },
        { id: 'Lepaskan sebelum berenang, mandi, atau berolahraga.', en: 'Take it off before swimming, showering or exercising.' },
        { id: 'Lepas cincin saat bersih-bersih atau berkebun.', en: 'Remove rings when cleaning or gardening.' },
      ],
    },
    {
      icon: 'cleaning' as CareIcon,
      label: { id: '02 · Perawatan lembut', en: '02 · Gentle care' },
      title: { id: 'Membersihkan', en: 'Cleaning' },
      tips: [
        { id: 'Lap dengan kain lembut bebas serat setiap selesai dipakai.', en: 'Wipe with a soft, lint-free cloth after each wear.' },
        { id: 'Untuk pembersihan lebih dalam, gunakan sabun lembut dan air hangat, lalu keringkan sepenuhnya.', en: 'For a deeper clean, use mild soap and lukewarm water, then dry fully.' },
        { id: 'Hindari pemutih, klorin, dan pembersih keras.', en: 'Avoid bleach, chlorine and harsh cleaning products.' },
      ],
    },
    {
      icon: 'storing' as CareIcon,
      label: { id: '03 · Di antara pemakaian', en: '03 · Between wears' },
      title: { id: 'Menyimpan', en: 'Storing' },
      tips: [
        { id: 'Simpan setiap perhiasan di kantong atau kotaknya sendiri agar tidak tergores.', en: 'Keep each piece in its own pouch or box to prevent scratches.' },
        { id: 'Kaitkan pengait rantai agar kalung tidak kusut.', en: 'Fasten chain clasps so necklaces don’t tangle.' },
        { id: 'Simpan di tempat sejuk dan kering, jauh dari lembap.', en: 'Store somewhere cool and dry, away from humidity.' },
      ],
    },
  ],
  // PENDING: cleaning/resizing/repair services are not yet a confirmed offering (PRD §14).
  ctaTitle: { id: 'Butuh pembersihan atau perbaikan profesional?', en: 'Need a professional clean or repair?' },
  ctaBody: { id: 'Tim kami dapat membantu pembersihan, penyesuaian ukuran, dan perbaikan.', en: 'Our team can help with cleaning, resizing and repairs.' },
  cta: { id: 'Chat dengan kami', en: 'Chat with us' },
  message: { id: 'Halo Aurelle, saya ingin bertanya tentang perawatan atau perbaikan.', en: 'Hello Aurelle, I have a question about care or repairs.' },
};

/* ------------------------------------------------------------------ */
/* Trust bar                                                            */
/* ------------------------------------------------------------------ */

export type TrustIcon = 'delivery' | 'authentic' | 'warranty' | 'returns';

/**
 * PENDING (PRD §14): shipping insurance and per-SKU certification are open decisions
 * (the warranty period is set in BRAND_CONTACT). The copy follows the approved mockup and must be confirmed before launch.
 */
export const trustPoints: { icon: TrustIcon; title: I18nText; body: I18nText; policyLink?: boolean }[] = [
  {
    icon: 'delivery',
    title: { id: 'Pengiriman berasuransi', en: 'Insured delivery' },
    body: { id: 'Dikemas aman, diasuransikan selama pengiriman.', en: 'Packed securely, insured in transit.' },
  },
  {
    icon: 'authentic',
    title: { id: 'Keaslian bersertifikat', en: 'Certified authentic' },
    body: { id: 'Setiap perhiasan disertai sertifikat.', en: 'Every piece comes with a certificate.' },
  },
  {
    icon: 'warranty',
    title: { id: 'Garansi {{period}}', en: '{{period}} warranty' },
    body: { id: 'Mencakup cacat produksi.', en: 'Covers manufacturing defects.' },
  },
  {
    icon: 'returns',
    title: { id: 'Retur & pembatalan', en: 'Returns & cancellation' },
    body: { id: 'untuk detailnya.', en: 'for details.' },
    policyLink: true,
  },
];

export const trustPolicyLink: I18nText = { id: 'Lihat kebijakan kami', en: 'See our policy' };
