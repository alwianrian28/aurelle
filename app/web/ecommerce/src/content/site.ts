import type { I18nText } from '../types/domain';

/**
 * Konten halaman informasi (F-19) — disusun seperti payload CMS (F-20) agar mudah dipindah ke backend.
 *
 * Aturan penulisan:
 * - FR-19-02: klaim brand (Our Story) WAJIB bersumber dari materi brand yang disetujui.
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
/* FAQ (F-19) — hanya jawaban dari aturan final/baseline               */
/* ------------------------------------------------------------------ */

export const faq: { q: I18nText; a: I18nText; refs: string[]; pending?: string[] }[] = [
  {
    q: { id: 'Apakah saya perlu akun untuk berbelanja?', en: 'Do I need an account to shop?' },
    a: {
      id: 'Anda dapat menjelajah tanpa akun. Login dengan Google atau email diperlukan sebelum checkout dan membayar.',
      en: 'You can browse without an account. Signing in with Google or email is required before checkout and paying.',
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
      id: 'Ketentuan pengiriman internasional untuk pesanan ready stock.',
      en: 'International shipping terms for ready-stock orders.',
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
            id: 'Subtotal, pajak, ongkos kirim, bea masuk, dan biaya lain ditampilkan terpisah saat checkout.',
            en: 'Subtotal, taxes, shipping, import duties, and other fees are shown separately at checkout.',
          },
        ],
        refs: ['BR-15'],
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
            id: 'Pesanan dikirim setelah pembayaran lunas terverifikasi.',
            en: 'Orders ship once full payment has been verified.',
          },
        ],
        refs: ['BR-13'],
      },
    ],
  },
  payment: {
    title: { id: 'Kebijakan Pembayaran', en: 'Payment Policy' },
    intro: {
      id: 'Metode, mata uang, dan ketentuan pembayaran di Aurelle.',
      en: 'Payment methods, currencies, and terms at Aurelle.',
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
        title: { id: 'Pelunasan', en: 'Full payment' },
        body: [
          {
            id: 'Seluruh pesanan wajib dibayar lunas saat checkout. Tidak tersedia DP maupun cicilan.',
            en: 'All orders must be paid in full at checkout. Deposits and instalments are not available.',
          },
        ],
        refs: ['BR-10'],
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
    title: { id: 'Kebijakan Retur & Pembatalan', en: 'Return & Cancellation Policy' },
    intro: {
      id: 'Ketentuan retur dan pembatalan pesanan.',
      en: 'Terms for returns and order cancellations.',
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
        id: 'cancel',
        title: { id: 'Pembatalan', en: 'Cancellation' },
        body: [
          {
            id: 'Pesanan yang belum dibayar hingga batas waktu reservasi dibatalkan otomatis dan stok dilepas kembali.',
            en: 'Orders left unpaid past the reservation window are cancelled automatically and the stock is released.',
          },
        ],
        pending: {
          od: ['OD-01', 'OD-28'],
          note: {
            id: 'Ketentuan pembatalan setelah pembayaran lunas akan diperbarui.',
            en: 'Terms for cancellation after full payment will be updated.',
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
            id: 'Kebijakan pengiriman, pembayaran, serta retur & pembatalan merupakan bagian dari syarat ini.',
            en: 'The shipping, payment, and return & cancellation policies form part of these terms.',
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
    title: { id: 'Koleksi ready stock', en: 'Ready-stock collections' },
    body: {
      id: 'Aurelle menghadirkan cincin, gelang, kalung, dan anting dengan material campuran — siap dikirim.',
      en: 'Aurelle offers rings, bracelets, necklaces, and earrings in mixed materials — ready to ship.',
    },
  },
];
