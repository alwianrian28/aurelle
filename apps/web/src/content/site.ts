import type { I18nText } from '../types/domain';

/**
 * Konten halaman informasi (F-19) — disusun seperti payload CMS (F-20) agar mudah dipindah ke backend.
 *
 * Aturan penulisan:
 * - FR-19-02: klaim brand (Our Story, Craftsmanship) WAJIB bersumber dari materi brand yang disetujui.
 *   Teks di sini netral dan ditandai `draft` sampai materi resmi tersedia (OD-17).
 * - FR-19-04 / AC-19-02: aturan yang masih OD terbuka TIDAK ditulis sebagai aturan final;
 *   ditandai `pending` dengan rujukan OD-nya.
 */

export interface ContentBlock {
  id: string;
  title: I18nText;
  body: I18nText[];
  /** Rujukan aturan bisnis (BR/FR) yang menjadi dasar teks — untuk audit konten. */
  refs?: string[];
  /** Bagian bergantung pada keputusan terbuka → tampil sebagai "akan diperbarui". */
  pending?: { od: string[]; note: I18nText };
}

/* ------------------------------------------------------------------ */
/* Custom & PO (FR-19-06, AC-19-03)                                    */
/* ------------------------------------------------------------------ */

export const customJourney: { title: I18nText; body: I18nText; refs: string[] }[] = [
  {
    title: { id: 'Ajukan kebutuhan', en: 'Submit your request' },
    body: {
      id: 'Isi jenis perhiasan, referensi desain, material, ukuran, engraving, dan anggaran opsional. Tidak ada minimum order.',
      en: 'Share the jewelry type, design reference, material, size, engraving, and an optional budget. There is no minimum order.',
    },
    refs: ['FR-09-01', 'BR-31'],
  },
  {
    title: { id: 'Konsultasi via WhatsApp', en: 'Consult on WhatsApp' },
    body: {
      id: 'Tim kami membahas detail bersama Anda di WhatsApp. Setiap keputusan transaksi tetap tercatat di akun Anda.',
      en: 'Our team discusses the details with you on WhatsApp. Every transaction decision is still recorded in your account.',
    },
    refs: ['BR-18'],
  },
  {
    title: { id: 'Penawaran all-inclusive', en: 'All-inclusive quote' },
    body: {
      id: 'Harga final sudah mencakup produk, pajak, ongkos kirim, bea masuk, dan biaya terkait.',
      en: 'The final price already covers the product, taxes, shipping, import duties, and related fees.',
    },
    refs: ['BR-14'],
  },
  {
    title: { id: 'Sampel & revisi', en: 'Sample & revisions' },
    body: {
      id: 'Setiap PO/custom mendapatkan sampel dengan material yang lebih terjangkau. Anda mendapat maksimal 3 revisi sampel gratis sebelum persetujuan final.',
      en: 'Every PO/custom order receives a sample in a more affordable material. You get up to 3 free sample revisions before final approval.',
    },
    refs: ['BR-19', 'BR-21'],
  },
  {
    title: { id: 'Produksi & quality control', en: 'Production & quality control' },
    body: {
      id: 'Produksi final dimulai hanya setelah Anda sendiri menyetujui sampel di website.',
      en: 'Final production starts only after you personally approve the sample on the website.',
    },
    refs: ['BR-34', 'BR-35'],
  },
  {
    title: { id: 'Pelunasan & pengiriman', en: 'Settlement & delivery' },
    body: {
      id: 'Seluruh tagihan dilunasi sebelum pengiriman final, lalu pesanan dikirim melalui kurir internasional.',
      en: 'All invoices are settled before final shipment, then your order ships via an international courier.',
    },
    refs: ['BR-13', 'BR-05'],
  },
];

export const paymentSchemes: { title: I18nText; body: I18nText; refs: string[] }[] = [
  {
    title: { id: 'Lunas', en: 'Full payment' },
    body: { id: 'Bayar 100% setelah penawaran disepakati.', en: 'Pay 100% once the quote is agreed.' },
    refs: ['BR-11'],
  },
  {
    title: { id: 'DP minimal 20%', en: 'Deposit from 20%' },
    body: {
      id: 'Bayar uang muka minimal 20%, sisanya dilunasi sebelum pengiriman final.',
      en: 'Pay a deposit of at least 20%; the balance is settled before final shipment.',
    },
    refs: ['BR-11', 'BR-13'],
  },
  {
    title: { id: 'Split 50% + 50%', en: 'Split 50% + 50%' },
    body: {
      id: '50% pertama setelah konsultasi dan kesepakatan, 50% kedua saat barang selesai dan siap dikirim.',
      en: 'The first 50% after consultation and agreement, the second 50% when the piece is finished and ready to ship.',
    },
    refs: ['BR-11', 'BR-12'],
  },
];

/** Catatan penting Custom & PO — hanya aturan final; sisanya ditandai pending. */
export const customNotes: ContentBlock[] = [
  {
    id: 'forfeit',
    title: { id: 'Pembatalan oleh pelanggan', en: 'Cancellation by the customer' },
    body: [
      {
        id: 'DP atau pembayaran pertama skema split hangus jika pelanggan membatalkan pesanan.',
        en: 'The deposit or first split payment is forfeited if the customer cancels the order.',
      },
    ],
    refs: ['BR-24'],
    pending: {
      od: ['OD-01'],
      note: {
        id: 'Ketentuan pembatalan setelah pembayaran 100% akan diperbarui.',
        en: 'Terms for cancellation after 100% payment will be updated.',
      },
    },
  },
  {
    id: 'final-revision',
    title: { id: 'Revisi barang final', en: 'Revising the finished piece' },
    body: [
      {
        id: 'Barang PO/custom dapat dikembalikan untuk revisi dengan biaya tambahan. Revisi tidak otomatis menghasilkan refund.',
        en: 'PO/custom pieces can be returned for revision at an additional cost. A revision does not automatically result in a refund.',
      },
    ],
    refs: ['BR-22', 'BR-33'],
  },
  {
    id: 'sample-cost',
    title: { id: 'Biaya sampel', en: 'Sample costs' },
    body: [{ id: 'Aurelle menanggung biaya terkait sampel.', en: 'Aurelle covers sample-related costs.' }],
    refs: ['BR-20'],
    pending: {
      od: ['OD-06'],
      note: {
        id: 'Rincian cakupan biaya sampel akan diperbarui.',
        en: 'Details of what sample costs cover will be updated.',
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/* FAQ (F-19) — hanya jawaban dari aturan final/baseline               */
/* ------------------------------------------------------------------ */

export const faq: { q: I18nText; a: I18nText; refs: string[]; pending?: string[] }[] = [
  {
    q: { id: 'Apakah saya perlu akun untuk berbelanja?', en: 'Do I need an account to shop?' },
    a: {
      id: 'Anda dapat menjelajah tanpa akun. Login dengan Google atau email diperlukan sebelum checkout, mengajukan PO/custom, dan membayar.',
      en: 'You can browse without an account. Signing in with Google or email is required before checkout, submitting a PO/custom request, and paying.',
    },
    refs: ['BR-03'],
  },
  {
    q: { id: 'Metode pembayaran apa yang tersedia?', en: 'Which payment methods are available?' },
    a: {
      id: 'Kartu Visa/Mastercard dan QRIS, sesuai dukungan penyedia pembayaran. Ketersediaan per mata uang akan dikonfirmasi saat checkout.',
      en: 'Visa/Mastercard cards and QRIS, subject to payment-provider support. Availability per currency is confirmed at checkout.',
    },
    refs: ['BR-09'],
    pending: ['OD-11'],
  },
  {
    q: { id: 'Mata uang apa yang didukung?', en: 'Which currencies are supported?' },
    a: {
      id: 'IDR dan USD. Harga USD dikonversi dari kurs yang berlaku dan dikunci saat checkout.',
      en: 'IDR and USD. USD prices are converted from the current rate and locked at checkout.',
    },
    refs: ['BR-07', 'BR-08'],
  },
  {
    q: { id: 'Apakah produk ready stock bisa dikembalikan?', en: 'Can ready-stock items be returned?' },
    a: {
      id: 'Produk ready stock tidak menerima retur. Ketentuan untuk barang cacat atau tidak sesuai sedang difinalkan dan akan diperbarui.',
      en: 'Ready-stock items are non-returnable. Terms for defective or incorrect items are being finalized and will be updated.',
    },
    refs: ['BR-23'],
    pending: ['OD-03'],
  },
  {
    q: { id: 'Bagaimana cara memesan desain custom?', en: 'How do I order a custom design?' },
    a: {
      id: 'Isi form pengajuan di halaman Custom & PO, lalu lanjutkan konsultasi melalui WhatsApp. Tidak ada minimum order.',
      en: 'Fill in the request form on the Custom & PO page, then continue the consultation on WhatsApp. There is no minimum order.',
    },
    refs: ['BR-18', 'BR-31'],
  },
  {
    q: { id: 'Skema pembayaran PO/custom apa saja?', en: 'What payment schemes apply to PO/custom?' },
    a: {
      id: 'Lunas, DP minimal 20%, atau split 50% + 50%. Harga final bersifat all-inclusive.',
      en: 'Full payment, a deposit from 20%, or a 50% + 50% split. The final price is all-inclusive.',
    },
    refs: ['BR-11', 'BR-14'],
  },
  {
    q: { id: 'Berapa kali saya bisa merevisi sampel?', en: 'How many times can I revise the sample?' },
    a: {
      id: 'Maksimal 3 revisi sampel gratis sebelum persetujuan final.',
      en: 'Up to 3 free sample revisions before final approval.',
    },
    refs: ['BR-21'],
  },
  {
    q: { id: 'Apakah Aurelle mengirim ke luar negeri?', en: 'Does Aurelle ship internationally?' },
    a: {
      id: 'Ya, melalui kurir internasional. Daftar negara tujuan akan diperbarui; ketersediaan diperiksa saat checkout.',
      en: 'Yes, via international couriers. The list of destination countries will be updated; availability is checked at checkout.',
    },
    refs: ['BR-05'],
    pending: ['OD-07'],
  },
];

/* ------------------------------------------------------------------ */
/* Policies (FR-19-04, AC-19-02)                                       */
/* ------------------------------------------------------------------ */

export type PolicySlug = 'shipping' | 'payment' | 'revision-return' | 'privacy' | 'terms';

export const policies: Record<PolicySlug, { title: I18nText; intro: I18nText; blocks: ContentBlock[] }> = {
  shipping: {
    title: { id: 'Kebijakan Pengiriman', en: 'Shipping Policy' },
    intro: {
      id: 'Ketentuan pengiriman internasional untuk pesanan ready stock dan PO/custom.',
      en: 'International shipping terms for ready-stock and PO/custom orders.',
    },
    blocks: [
      {
        id: 'courier',
        title: { id: 'Kurir internasional', en: 'International couriers' },
        body: [
          {
            id: 'Pesanan dikirim melalui integrasi kurir internasional. Layanan dan estimasi waktu ditampilkan saat checkout.',
            en: 'Orders ship through integrated international couriers. Services and estimated times are shown at checkout.',
          },
        ],
        refs: ['BR-05'],
        pending: {
          od: ['OD-07', 'OD-12'],
          note: { id: 'Daftar negara dan kurir resmi akan diperbarui.', en: 'Official countries and couriers will be updated.' },
        },
      },
      {
        id: 'costs',
        title: { id: 'Biaya', en: 'Costs' },
        body: [
          {
            id: 'Ready stock: subtotal, pajak, ongkos kirim, bea masuk, dan biaya lain ditampilkan terpisah saat checkout.',
            en: 'Ready stock: subtotal, taxes, shipping, import duties, and other fees are shown separately at checkout.',
          },
          {
            id: 'PO/custom: harga final bersifat all-inclusive, termasuk ongkos kirim dan bea masuk.',
            en: 'PO/custom: the final price is all-inclusive, including shipping and import duties.',
          },
        ],
        refs: ['BR-14', 'BR-15'],
        pending: {
          od: ['OD-14', 'OD-19'],
          note: {
            id: 'Ketentuan selisih bea/ongkir aktual dan asuransi pengiriman akan diperbarui.',
            en: 'Terms for actual duty/shipping differences and shipping insurance will be updated.',
          },
        },
      },
      {
        id: 'settlement',
        title: { id: 'Syarat pengiriman', en: 'Shipping conditions' },
        body: [
          {
            id: 'Seluruh tagihan harus lunas sebelum pengiriman final.',
            en: 'All invoices must be settled before final shipment.',
          },
        ],
        refs: ['BR-13'],
      },
    ],
  },
  payment: {
    title: { id: 'Kebijakan Pembayaran', en: 'Payment Policy' },
    intro: {
      id: 'Metode, mata uang, dan skema pembayaran di Aurelle.',
      en: 'Payment methods, currencies, and schemes at Aurelle.',
    },
    blocks: [
      {
        id: 'methods',
        title: { id: 'Metode pembayaran', en: 'Payment methods' },
        body: [
          {
            id: 'Kartu Visa/Mastercard dan QRIS, sesuai dukungan penyedia pembayaran.',
            en: 'Visa/Mastercard cards and QRIS, subject to payment-provider support.',
          },
        ],
        refs: ['BR-09'],
        pending: {
          od: ['OD-11'],
          note: {
            id: 'Ketersediaan metode per mata uang akan diperbarui.',
            en: 'Method availability per currency will be updated.',
          },
        },
      },
      {
        id: 'currency',
        title: { id: 'Mata uang', en: 'Currency' },
        body: [
          {
            id: 'Harga ditetapkan dalam IDR. Nominal USD dihitung dari kurs tersimpan dan dikunci saat checkout.',
            en: 'Prices are set in IDR. USD amounts are calculated from the stored rate and locked at checkout.',
          },
        ],
        refs: ['BR-07', 'BR-08'],
        pending: {
          od: ['OD-15'],
          note: { id: 'Aturan pembulatan USD akan diperbarui.', en: 'USD rounding rules will be updated.' },
        },
      },
      {
        id: 'schemes',
        title: { id: 'Skema pembayaran', en: 'Payment schemes' },
        body: [
          { id: 'Ready stock wajib dibayar lunas.', en: 'Ready stock must be paid in full.' },
          {
            id: 'PO/custom dapat dibayar lunas, DP minimal 20%, atau split 50% + 50%. Split pertama dibayar setelah konsultasi dan kesepakatan; split kedua saat barang selesai dan siap dikirim.',
            en: 'PO/custom can be paid in full, with a deposit from 20%, or as a 50% + 50% split. The first split is paid after consultation and agreement; the second when the piece is finished and ready to ship.',
          },
        ],
        refs: ['BR-10', 'BR-11', 'BR-12'],
      },
      {
        id: 'invoice',
        title: { id: 'Pajak & invoice', en: 'Tax & invoices' },
        body: [],
        pending: {
          od: ['OD-16'],
          note: { id: 'Ketentuan pajak dan format invoice akan diperbarui.', en: 'Tax rules and invoice format will be updated.' },
        },
      },
    ],
  },
  'revision-return': {
    title: { id: 'Kebijakan Revisi & Retur', en: 'Revision & Return Policy' },
    intro: {
      id: 'Ketentuan retur, revisi sampel, revisi barang final, dan pembatalan.',
      en: 'Terms for returns, sample revisions, final-piece revisions, and cancellations.',
    },
    blocks: [
      {
        id: 'ready-stock',
        title: { id: 'Ready stock', en: 'Ready stock' },
        body: [{ id: 'Produk ready stock tidak menerima retur.', en: 'Ready-stock items are non-returnable.' }],
        refs: ['BR-23'],
        pending: {
          od: ['OD-03'],
          note: {
            id: 'Penanganan barang cacat, tidak sesuai, atau rusak dalam pengiriman akan diperbarui.',
            en: 'Handling of defective, incorrect, or shipping-damaged items will be updated.',
          },
        },
      },
      {
        id: 'sample',
        title: { id: 'Revisi sampel PO/custom', en: 'PO/custom sample revisions' },
        body: [
          {
            id: 'Maksimal 3 revisi sampel gratis sebelum persetujuan final. Persetujuan sampel hanya dapat diberikan oleh pelanggan.',
            en: 'Up to 3 free sample revisions before final approval. Sample approval can only be given by the customer.',
          },
        ],
        refs: ['BR-21', 'BR-34'],
        pending: {
          od: ['OD-02'],
          note: {
            id: 'Ketentuan revisi ke-4 dan seterusnya akan diperbarui.',
            en: 'Terms for the 4th and subsequent revisions will be updated.',
          },
        },
      },
      {
        id: 'final',
        title: { id: 'Revisi barang final', en: 'Final-piece revisions' },
        body: [
          {
            id: 'Barang PO/custom dapat dikembalikan untuk revisi dengan biaya tambahan. Revisi tidak otomatis menghasilkan refund.',
            en: 'PO/custom pieces may be returned for revision at an additional cost. Revisions do not automatically result in a refund.',
          },
        ],
        refs: ['BR-22', 'BR-33'],
        pending: {
          od: ['OD-10'],
          note: {
            id: 'Ketentuan revisi setelah pengiriman akan diperbarui.',
            en: 'Terms for revisions after delivery will be updated.',
          },
        },
      },
      {
        id: 'cancel',
        title: { id: 'Pembatalan', en: 'Cancellation' },
        body: [
          {
            id: 'DP atau pembayaran pertama skema split hangus jika pelanggan membatalkan.',
            en: 'The deposit or first split payment is forfeited if the customer cancels.',
          },
        ],
        refs: ['BR-24'],
        pending: {
          od: ['OD-01', 'OD-28'],
          note: {
            id: 'Ketentuan pembatalan setelah pembayaran 100% (PO/custom maupun ready stock) akan diperbarui.',
            en: 'Terms for cancellation after 100% payment (PO/custom and ready stock) will be updated.',
          },
        },
      },
    ],
  },
  privacy: {
    title: { id: 'Privacy Policy', en: 'Privacy Policy' },
    intro: {
      id: 'Kebijakan privasi lengkap sedang disusun bersama penasihat hukum.',
      en: 'The full privacy policy is being prepared with legal counsel.',
    },
    blocks: [
      {
        id: 'draft',
        title: { id: 'Status dokumen', en: 'Document status' },
        body: [
          {
            id: 'Kami hanya memakai data akun, alamat, dan kontak Anda untuk memproses pesanan, pengiriman, dan konsultasi. Langganan newsletter selalu memerlukan persetujuan eksplisit dan dapat dihentikan kapan saja.',
            en: 'We only use your account, address, and contact data to process orders, shipping, and consultations. Newsletter subscription always requires explicit consent and can be stopped at any time.',
          },
        ],
        refs: ['BR-04', 'FR-06-01', 'FR-06-03'],
        pending: {
          od: ['OD-25'],
          note: {
            id: 'Ketentuan cookie, retensi data, dan penghapusan akun akan diperbarui.',
            en: 'Cookie, data-retention, and account-deletion terms will be updated.',
          },
        },
      },
    ],
  },
  terms: {
    title: { id: 'Syarat & Ketentuan', en: 'Terms & Conditions' },
    intro: {
      id: 'Ringkasan ketentuan transaksi. Dokumen lengkap akan diterbitkan setelah seluruh keputusan kebijakan disahkan.',
      en: 'A summary of transaction terms. The full document will be published once all policy decisions are approved.',
    },
    blocks: [
      {
        id: 'account',
        title: { id: 'Akun', en: 'Account' },
        body: [
          {
            id: 'Login diperlukan sebelum checkout. Akun email wajib terverifikasi sebelum pembayaran.',
            en: 'Sign-in is required before checkout. Email accounts must be verified before payment.',
          },
        ],
        refs: ['BR-03', 'FR-01-03'],
      },
      {
        id: 'pricing',
        title: { id: 'Harga', en: 'Pricing' },
        body: [
          {
            id: 'Harga pesanan yang sudah disetujui dikunci; perubahan harga material tidak memengaruhi pesanan tersebut.',
            en: 'Prices of approved orders are locked; changes in material prices do not affect those orders.',
          },
        ],
        refs: ['BR-36'],
      },
      {
        id: 'policies',
        title: { id: 'Kebijakan terkait', en: 'Related policies' },
        body: [
          {
            id: 'Ketentuan pengiriman, pembayaran, serta revisi & retur merupakan bagian dari syarat ini.',
            en: 'The shipping, payment, and revision & return policies form part of these terms.',
          },
        ],
        pending: {
          od: ['OD-01', 'OD-03', 'OD-25'],
          note: {
            id: 'Beberapa ketentuan masih menunggu keputusan dan akan diperbarui.',
            en: 'Some terms are still awaiting decisions and will be updated.',
          },
        },
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Craftsmanship & panduan (FR-19-03)                                  */
/* ------------------------------------------------------------------ */

/** Draf struktur — teks final menunggu materi brand yang disetujui (FR-19-02, OD-17). */
export const craftSections: { id: string; eyebrow: I18nText; title: I18nText; body: I18nText }[] = [
  {
    id: 'materials',
    eyebrow: { id: 'Material', en: 'Materials' },
    title: { id: 'Material campuran pilihan', en: 'Considered mixed materials' },
    body: {
      id: 'Aurelle memadukan beberapa material dalam setiap karya. Detail material per produk tercantum di halaman produk.',
      en: 'Aurelle combines several materials in each piece. Material details for every product are listed on its product page.',
    },
  },
  {
    id: 'process',
    eyebrow: { id: 'Proses', en: 'Process' },
    title: { id: 'Dari sampel hingga karya final', en: 'From sample to finished piece' },
    body: {
      id: 'Untuk PO/custom, setiap desain melalui tahap sampel dan persetujuan Anda sebelum produksi final dan quality control.',
      en: 'For PO/custom, every design goes through a sample stage and your approval before final production and quality control.',
    },
  },
];

export const careTips: I18nText[] = [
  {
    id: 'Simpan setiap perhiasan secara terpisah agar tidak saling menggores.',
    en: 'Store each piece separately to avoid scratches.',
  },
  {
    id: 'Lepaskan perhiasan sebelum berenang, mandi, atau berolahraga.',
    en: 'Remove jewelry before swimming, bathing, or exercising.',
  },
  {
    id: 'Hindari kontak langsung dengan parfum, lotion, dan bahan kimia rumah tangga.',
    en: 'Avoid direct contact with perfume, lotion, and household chemicals.',
  },
  {
    id: 'Bersihkan dengan kain lembut yang kering setelah dipakai.',
    en: 'Wipe with a soft, dry cloth after wearing.',
  },
];

/** Tabel konversi ukuran cincin standar (diameter dalam mm). Data konversi umum, bukan klaim brand. */
export const ringSizes: { us: string; diameterMm: string; circumferenceMm: string }[] = [
  { us: '5', diameterMm: '15.7', circumferenceMm: '49.3' },
  { us: '6', diameterMm: '16.5', circumferenceMm: '51.9' },
  { us: '7', diameterMm: '17.3', circumferenceMm: '54.4' },
  { us: '8', diameterMm: '18.1', circumferenceMm: '57.0' },
  { us: '9', diameterMm: '18.9', circumferenceMm: '59.5' },
  { us: '10', diameterMm: '19.8', circumferenceMm: '62.1' },
];

/** Our Story — kerangka narasi; teks resmi menunggu materi brand (FR-19-02). */
export const storyChapters: { eyebrow: I18nText; title: I18nText; body: I18nText }[] = [
  {
    eyebrow: { id: 'Awal', en: 'Beginnings' },
    title: { id: 'Berangkat dari ketelitian', en: 'Rooted in attention to detail' },
    body: {
      id: 'Bagian ini akan memuat kisah lahirnya Aurelle dari materi brand yang telah disetujui.',
      en: 'This section will tell the story of how Aurelle began, drawn from approved brand materials.',
    },
  },
  {
    eyebrow: { id: 'Filosofi', en: 'Philosophy' },
    title: { id: 'Personal dan tahan lama', en: 'Personal and enduring' },
    body: {
      id: 'Bagian ini akan menjelaskan nilai dan filosofi desain Aurelle sesuai materi brand resmi.',
      en: 'This section will describe Aurelle’s values and design philosophy based on official brand materials.',
    },
  },
  {
    eyebrow: { id: 'Hari ini', en: 'Today' },
    title: { id: 'Ready stock dan karya custom', en: 'Ready stock and custom pieces' },
    body: {
      id: 'Aurelle menghadirkan cincin, gelang, kalung, dan anting dengan material campuran — siap dikirim maupun dibuat khusus untuk Anda.',
      en: 'Aurelle offers rings, bracelets, necklaces, and earrings in mixed materials — ready to ship or made especially for you.',
    },
  },
];
