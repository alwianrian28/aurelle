import type { I18nText } from '../types/domain';

/**
 * Konten halaman informasi (F-19) — disusun seperti payload CMS (F-20) agar mudah dipindah ke backend.
 *
 * Aturan penulisan:
 * - FR-19-04 / AC-19-02: aturan yang masih OD terbuka TIDAK ditulis sebagai aturan final;
 *   ditandai `pending` dengan rujukan OD-nya dan tampil sebagai baris "To add".
 * - PRD §8.1: tidak ada klaim material sampai diverifikasi; halaman produk adalah acuannya.
 */

export interface ContentBlock {
  id: string;
  title: I18nText;
  body: I18nText[];
  /** Rujukan aturan bisnis (BR/FR) yang menjadi dasar teks — untuk audit konten. */
  refs?: string[];
  /** Bagian bergantung pada keputusan terbuka. `note` menyebut APA yang belum ada (frasa benda). */
  pending?: { od: string[]; note: I18nText };
}

/* ------------------------------------------------------------------ */
/* FAQ (F-19) — hanya jawaban dari aturan final/baseline               */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  q: I18nText;
  a: I18nText;
  refs: string[];
  pending?: string[];
  /** Also shown in the short list on the Contact page. */
  featured?: boolean;
}

export const faqGroups: { id: string; title: I18nText; items: FaqItem[] }[] = [
  {
    id: 'ordering',
    title: { id: 'Pemesanan & akun', en: 'Ordering & account' },
    items: [
      {
        q: { id: 'Apakah saya perlu akun untuk berbelanja?', en: 'Do I need an account to shop?' },
        a: {
          id: 'Anda dapat menjelajah tanpa akun. Login dengan Google atau email diperlukan sebelum checkout dan membayar.',
          en: 'You can browse without an account. Signing in with Google or email is required before checkout and paying.',
        },
        refs: ['BR-03'],
        featured: true,
      },
      {
        q: { id: 'Bisakah saya membatalkan pesanan?', en: 'Can I cancel my order?' },
        a: {
          id: 'Pesanan yang belum dibayar hingga batas waktu reservasi dibatalkan otomatis dan stoknya dilepas kembali. Ketentuan pembatalan setelah pembayaran lunas sedang difinalkan; hubungi kami dengan nomor pesanan Anda dan kami akan membantu.',
          en: 'An order left unpaid past the reservation window is cancelled automatically and its stock is released. Terms for cancelling after full payment are being finalized; message us with your order number and we will help.',
        },
        refs: ['FR-08'],
        pending: ['OD-01', 'OD-28'],
      },
    ],
  },
  {
    id: 'payment',
    title: { id: 'Pembayaran', en: 'Payment' },
    items: [
      {
        q: { id: 'Metode pembayaran apa yang tersedia?', en: 'Which payment methods are available?' },
        a: {
          id: 'Kartu Visa/Mastercard dan QRIS, sesuai dukungan penyedia pembayaran. Ketersediaan per mata uang akan dikonfirmasi saat checkout.',
          en: 'Visa/Mastercard cards and QRIS, subject to payment-provider support. Availability per currency is confirmed at checkout.',
        },
        refs: ['BR-09'],
        pending: ['OD-11'],
        featured: true,
      },
      {
        q: { id: 'Mata uang apa yang didukung?', en: 'Which currencies are supported?' },
        a: {
          id: 'IDR dan USD. Harga USD dikonversi dari kurs yang berlaku dan dikunci saat checkout.',
          en: 'IDR and USD. USD prices are converted from the current rate and locked at checkout.',
        },
        refs: ['BR-07', 'BR-08'],
        featured: true,
      },
      {
        q: { id: 'Bisakah saya membayar dengan cicilan?', en: 'Can I pay in instalments?' },
        a: {
          id: 'Tidak. Seluruh pesanan dibayar lunas saat checkout; DP maupun cicilan tidak tersedia.',
          en: 'No. All orders are paid in full at checkout; deposits and instalments are not available.',
        },
        refs: ['BR-10'],
      },
    ],
  },
  {
    id: 'shipping',
    title: { id: 'Pengiriman', en: 'Shipping' },
    items: [
      {
        q: { id: 'Apakah Aurelle mengirim ke luar negeri?', en: 'Does Aurelle ship internationally?' },
        a: {
          id: 'Ya, melalui kurir internasional. Daftar negara tujuan akan diperbarui; ketersediaan diperiksa saat checkout.',
          en: 'Yes, via international couriers. The list of destination countries will be updated; availability is checked at checkout.',
        },
        refs: ['BR-05'],
        pending: ['OD-07'],
        featured: true,
      },
      {
        q: { id: 'Kapan pesanan saya dikirim?', en: 'When will my order ship?' },
        a: {
          id: 'Pesanan dikirim setelah pembayaran lunas terverifikasi. Estimasi waktu tiap layanan ditampilkan saat checkout, dan perjalanan paket bisa Anda ikuti di halaman Lacak pesanan.',
          en: 'Orders ship once full payment has been verified. The estimate for each service is shown at checkout, and you can follow your parcel on the Track order page.',
        },
        refs: ['BR-13'],
      },
      {
        q: { id: 'Apakah saya membayar bea masuk?', en: 'Will I pay import duties?' },
        a: {
          id: 'Bea masuk, pajak, dan biaya lain ditampilkan terpisah saat checkout, sebelum Anda membayar. Ketentuan selisih bea aktual sedang difinalkan.',
          en: 'Import duties, taxes and other fees are shown separately at checkout, before you pay. Terms for differences in actual duties are being finalized.',
        },
        refs: ['BR-15'],
        pending: ['OD-14'],
      },
    ],
  },
  {
    id: 'returns',
    title: { id: 'Retur & produk', en: 'Returns & product' },
    items: [
      {
        q: { id: 'Apakah produk ready stock bisa dikembalikan?', en: 'Can ready-stock items be returned?' },
        a: {
          id: 'Produk ready stock tidak menerima retur. Ketentuan untuk barang cacat atau tidak sesuai sedang difinalkan dan akan diperbarui.',
          en: 'Ready-stock items are non-returnable. Terms for defective or incorrect items are being finalized and will be updated.',
        },
        refs: ['BR-23'],
        pending: ['OD-03'],
        featured: true,
      },
      {
        q: { id: 'Bagaimana jika barang saya tiba rusak atau tidak sesuai?', en: 'What if my item arrives damaged or incorrect?' },
        a: {
          id: 'Kirim pesan WhatsApp dengan nomor pesanan Anda agar kami dapat memeriksanya. Ketentuan lengkap untuk barang cacat, tidak sesuai, atau rusak dalam pengiriman sedang difinalkan.',
          en: 'Message us on WhatsApp with your order number so we can look into it. The full terms for defective, incorrect or shipping-damaged items are being finalized.',
        },
        refs: ['BR-23'],
        pending: ['OD-03'],
      },
      {
        q: { id: 'Terbuat dari apa perhiasannya?', en: 'What are the pieces made of?' },
        a: {
          id: 'Material setiap perhiasan tercantum di halaman produknya, dan itulah acuan pembelian Anda.',
          en: 'The materials of each piece are listed on its product page, which is the reference for your purchase.',
        },
        refs: ['PRD-8.1'],
      },
    ],
  },
];

/** The short list shown on the Contact page. */
export const faq: FaqItem[] = faqGroups.flatMap((group) => group.items).filter((item) => item.featured);

/* ------------------------------------------------------------------ */
/* Policies (FR-19-04, AC-19-02)                                       */
/* ------------------------------------------------------------------ */

export type PolicySlug = 'shipping' | 'payment' | 'revision-return' | 'privacy' | 'terms';

export interface Policy {
  title: I18nText;
  intro: I18nText;
  /** Publication date (ISO); null shows the pending marker until the text is approved. */
  updated: string | null;
  /** The few points a customer should take away, shown above the sections. */
  glance: I18nText[];
  blocks: ContentBlock[];
}

export const policies: Record<PolicySlug, Policy> = {
  shipping: {
    title: { id: 'Kebijakan pengiriman', en: 'Shipping policy' },
    intro: {
      id: 'Bagaimana dan kapan pesanan ready stock dikirim.',
      en: 'How and when ready-stock orders are shipped.',
    },
    updated: null,
    glance: [
      { id: 'Dikirim melalui kurir internasional terintegrasi', en: 'Ships through integrated international couriers' },
      { id: 'Layanan dan estimasi waktu tampil saat checkout', en: 'Services and delivery estimates shown at checkout' },
      { id: 'Bea dan biaya tampil terpisah sebelum Anda membayar', en: 'Duties and fees shown separately before you pay' },
      { id: 'Dikirim setelah pembayaran lunas terverifikasi', en: 'Ships once full payment is verified' },
    ],
    blocks: [
      {
        id: 'courier',
        title: { id: 'Kurir', en: 'Couriers' },
        body: [
          {
            id: 'Pesanan dikirim melalui kurir internasional terintegrasi. Layanan yang tersedia dan estimasi waktu pengiriman ditampilkan saat checkout.',
            en: 'Orders ship through integrated international couriers. Available services and estimated delivery times are shown at checkout.',
          },
        ],
        refs: ['BR-05'],
        pending: {
          od: ['OD-07', 'OD-12'],
          note: { id: 'Daftar resmi negara dan kurir', en: 'Official list of countries and couriers' },
        },
      },
      {
        id: 'costs',
        title: { id: 'Biaya', en: 'Costs' },
        body: [
          {
            id: 'Subtotal, pajak, ongkos kirim, bea masuk, dan biaya lain ditampilkan terpisah saat checkout, sehingga Anda melihat jumlah penuh sebelum membayar.',
            en: 'Subtotal, taxes, shipping, import duties and other fees are shown separately at checkout, so you see the full amount before you pay.',
          },
        ],
        refs: ['BR-15'],
        pending: {
          od: ['OD-14', 'OD-19'],
          note: {
            id: 'Ketentuan selisih bea atau ongkir aktual, dan asuransi pengiriman',
            en: 'Terms for actual duty or shipping differences, and shipping insurance',
          },
        },
      },
      {
        id: 'settlement',
        title: { id: 'Kapan pesanan dikirim', en: 'When orders ship' },
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
    title: { id: 'Kebijakan pembayaran', en: 'Payment policy' },
    intro: {
      id: 'Metode, mata uang, dan ketentuan pembayaran di Aurelle.',
      en: 'Payment methods, currencies and terms at Aurelle.',
    },
    updated: null,
    glance: [
      { id: 'Visa, Mastercard, dan QRIS', en: 'Visa, Mastercard and QRIS' },
      { id: 'Harga dalam IDR; nominal USD dikunci saat checkout', en: 'Prices in IDR; USD amounts locked at checkout' },
      { id: 'Bayar lunas saat checkout, tanpa cicilan', en: 'Full payment at checkout, no instalments' },
    ],
    blocks: [
      {
        id: 'methods',
        title: { id: 'Metode pembayaran', en: 'Payment methods' },
        body: [
          {
            id: 'Kartu Visa dan Mastercard, serta QRIS, sesuai dukungan penyedia pembayaran.',
            en: 'Visa and Mastercard cards, and QRIS, subject to payment-provider support.',
          },
        ],
        refs: ['BR-09'],
        pending: {
          od: ['OD-11'],
          note: { id: 'Ketersediaan metode per mata uang', en: 'Method availability per currency' },
        },
      },
      {
        id: 'currency',
        title: { id: 'Mata uang', en: 'Currency' },
        body: [
          {
            id: 'Harga ditetapkan dalam IDR. Nominal USD dihitung dari kurs tersimpan dan dikunci saat checkout.',
            en: 'Prices are set in IDR. USD amounts are calculated from our stored rate and locked at checkout.',
          },
        ],
        refs: ['BR-07', 'BR-08'],
        pending: {
          od: ['OD-15'],
          note: { id: 'Aturan pembulatan USD', en: 'USD rounding rules' },
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
          note: { id: 'Ketentuan pajak dan format invoice', en: 'Tax rules and invoice format' },
        },
      },
    ],
  },
  'revision-return': {
    title: { id: 'Kebijakan retur & pembatalan', en: 'Return & cancellation policy' },
    intro: {
      id: 'Apa yang dapat dikembalikan, dan bagaimana pembatalan pesanan berjalan.',
      en: 'What can be returned, and how order cancellation works.',
    },
    updated: null,
    glance: [
      { id: 'Produk ready stock tidak menerima retur', en: 'Ready-stock items are non-returnable' },
      {
        id: 'Pesanan yang belum dibayar batal otomatis setelah batas waktu reservasi',
        en: 'Unpaid orders cancel automatically after the reservation window',
      },
    ],
    blocks: [
      {
        id: 'ready-stock',
        title: { id: 'Produk ready stock', en: 'Ready-stock items' },
        body: [{ id: 'Produk ready stock tidak menerima retur.', en: 'Ready-stock items are non-returnable.' }],
        refs: ['BR-23'],
        pending: {
          od: ['OD-03'],
          note: {
            id: 'Penanganan barang cacat, tidak sesuai, atau rusak dalam pengiriman',
            en: 'How defective, incorrect or shipping-damaged items are handled',
          },
        },
      },
      {
        id: 'cancel',
        title: { id: 'Pembatalan', en: 'Cancellation' },
        body: [
          {
            id: 'Pesanan yang belum dibayar hingga batas waktu reservasi dibatalkan otomatis dan stok dilepas kembali.',
            en: 'Orders left unpaid past the reservation window are cancelled automatically, and the stock is released.',
          },
        ],
        pending: {
          od: ['OD-01', 'OD-28'],
          note: { id: 'Ketentuan pembatalan setelah pembayaran lunas', en: 'Terms for cancellation after full payment' },
        },
      },
      {
        id: 'help',
        title: { id: 'Butuh bantuan dengan pesanan?', en: 'Need help with an order?' },
        body: [
          {
            id: 'Kirim pesan WhatsApp dengan nomor pesanan Anda dan kami akan memeriksanya.',
            en: 'Message us on WhatsApp with your order number and we will look into it.',
          },
        ],
        refs: ['FR-09-03'],
      },
    ],
  },
  privacy: {
    title: { id: 'Kebijakan privasi', en: 'Privacy policy' },
    intro: {
      id: 'Ringkasan cara Aurelle memakai data Anda. Kebijakan lengkap sedang disusun bersama penasihat hukum.',
      en: 'A summary of how Aurelle uses your data. The full policy is being prepared with legal counsel.',
    },
    updated: null,
    glance: [
      {
        id: 'Data Anda hanya dipakai untuk pesanan, pengiriman, dan konsultasi',
        en: 'Your data is used only for orders, shipping and consultations',
      },
      { id: 'Email newsletter hanya dengan persetujuan eksplisit Anda', en: 'Newsletter emails only with your explicit consent' },
      { id: 'Berhenti berlangganan kapan saja', en: 'Unsubscribe at any time' },
    ],
    blocks: [
      {
        id: 'data-use',
        title: { id: 'Cara kami memakai data Anda', en: 'How we use your data' },
        body: [
          {
            id: 'Kami hanya memakai data akun, alamat, dan kontak Anda untuk memproses pesanan, pengiriman, dan konsultasi.',
            en: 'We only use your account, address and contact data to process orders, shipping and consultations.',
          },
        ],
        refs: ['BR-04'],
      },
      {
        id: 'newsletter',
        title: { id: 'Newsletter', en: 'Newsletter' },
        body: [
          {
            id: 'Berlangganan newsletter selalu memerlukan persetujuan eksplisit Anda, dan dapat dihentikan kapan saja.',
            en: 'Subscribing to the newsletter always requires your explicit consent, and you can stop it at any time.',
          },
        ],
        refs: ['FR-06-01', 'FR-06-03'],
      },
      {
        id: 'cookies',
        title: { id: 'Cookie, retensi & penghapusan', en: 'Cookies, retention & deletion' },
        body: [],
        pending: {
          od: ['OD-25'],
          note: {
            id: 'Ketentuan penggunaan cookie, retensi data, dan penghapusan akun',
            en: 'Cookie use, data retention and account deletion terms',
          },
        },
      },
    ],
  },
  terms: {
    title: { id: 'Syarat & ketentuan', en: 'Terms & conditions' },
    intro: {
      id: 'Ringkasan ketentuan transaksi. Dokumen lengkap akan diterbitkan setelah seluruh keputusan kebijakan disahkan.',
      en: 'A summary of transaction terms. The full document will be published once all policy decisions are approved.',
    },
    updated: null,
    glance: [
      { id: 'Login diperlukan sebelum checkout', en: 'Sign in required before checkout' },
      { id: 'Email terverifikasi diperlukan sebelum pembayaran', en: 'Verified email required before payment' },
      { id: 'Harga pesanan yang disetujui dikunci', en: 'Prices of approved orders are locked' },
    ],
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
            id: 'Harga pesanan yang sudah disetujui dikunci. Perubahan harga material setelahnya tidak memengaruhi pesanan tersebut.',
            en: 'Prices of approved orders are locked. Later changes in material prices do not affect those orders.',
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
            en: 'The Shipping, Payment and Return & Cancellation policies form part of these terms.',
          },
        ],
        pending: {
          od: ['OD-01', 'OD-03', 'OD-25'],
          note: { id: 'Ketentuan lain yang masih menunggu keputusan', en: 'Remaining terms awaiting decision' },
        },
      },
    ],
  },
};
