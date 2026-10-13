# Aurelle Product Requirements Document

Versi 2.0 • 12 Oktober 2026 • Revisi identitas Silver Luxury Jewelry • Draft untuk desain dan implementasi

Dokumen ini mencakup dua website: website publik Aurelle yang menggabungkan e-commerce dan company profile, serta website dashboard admin. Keduanya menggunakan satu sumber data dan backend Express.js. Keputusan bisnis yang telah disepakati menjadi baseline; usulan implementasi dan keputusan terbuka diberi label terpisah.

## 1. Tujuan dan ruang lingkup

Aurelle adalah brand perhiasan luxury modern dengan produk cincin, gelang, kalung, dan anting dalam konsep silver/white jewelry. Koleksi menggunakan material aktual yang terverifikasi dengan tampilan silver dan kombinasi batu sesuai spesifikasi produk. Identitas brand berpindah dari gold–ivory menjadi silver–graphite–pearl. Website harus membangun kepercayaan pada brand, menyediakan pembelian internasional, serta mengelola ready stock, pre-order (PO), dan custom dengan jejak persetujuan yang jelas.

Website publik melayani discovery, konsultasi, transaksi, persetujuan sampel, pelunasan, dan pelacakan. Dashboard melayani katalog, harga material, inventori, konsultasi, penawaran, produksi, pembayaran, pengiriman, konten, laporan, dan akses staf.

Peluncuran awal mencakup seluruh alur utama tersebut. Aplikasi mobile native, marketplace multivendor, AR virtual try-on, konfigurator desain 3D otomatis, serta integrasi WhatsApp otomatis tidak termasuk scope awal. Konsultasi WhatsApp menggunakan tautan dan ringkasan yang dicatat admin; otomatisasi membutuhkan keputusan tersendiri.

## 2. Pengguna dan hasil yang diharapkan

| Pengguna | Kebutuhan |
|---|---|
| Pengunjung | Mengenal brand, material, koleksi, dan kebijakan |
| Pelanggan ready stock | Memilih varian, melihat total biaya, membayar, dan melacak |
| Pelanggan PO/custom | Konsultasi, menyetujui penawaran dan sampel, melihat produksi dan membayar sisa |
| Staf | Menjalankan tugas sesuai izin tanpa mengubah data di luar kewenangan |
| Owner | Memantau bisnis, biaya, pesanan, dan aktivitas staf |

Metrik yang disiapkan: konversi katalog ke checkout, checkout ke pembayaran, konsultasi ke penawaran diterima, waktu persetujuan sampel, rata-rata revisi, waktu produksi, pelunasan tepat waktu, pembatalan, dan keberhasilan pengiriman. Target numerik ditetapkan setelah baseline operasional tersedia. Laporan IDR dan USD dipisah kecuali menggunakan kurs pelaporan yang eksplisit.

## 3. Aturan bisnis yang disepakati

| Area | Ketentuan |
|---|---|
| Login | Google atau email/password; login wajib sebelum checkout |
| Profil | Username dan alamat; telepon berkode negara untuk pengiriman/konsultasi |
| Bahasa | Indonesia dan Inggris |
| Mata uang | IDR dan USD |
| Metode pembayaran | Visa/Mastercard dan QRIS melalui payment gateway |
| Ready stock | Wajib pembayaran lunas di awal |
| PO/custom | Lunas, DP minimal 20%, atau split dua kali 50% + 50% |
| Split | 50% setelah konsultasi dan kesepakatan; 50% saat selesai dan siap kirim |
| Pengiriman | Seluruh tagihan wajib lunas sebelum pengiriman final |
| Custom | Dapat menentukan desain, material, ukuran, dan engraving |
| Harga | Admin memiliki katalog acuan harga material mengikuti pasar |
| PO/custom | Harga final all-inclusive: produk, pajak, ongkir, bea masuk, dan biaya terkait |
| Ready stock | Subtotal, pajak, ongkir, bea masuk, dan biaya lain ditampilkan terpisah |
| Sampel | Semua PO/custom memperoleh sampel dengan material murah |
| Biaya sampel | Pajak dan biaya terkait ditanggung Aurelle; cakupan rinci perlu ditetapkan |
| Revisi sampel | Maksimal 3 kali gratis sebelum persetujuan final |
| Revisi barang final | PO/custom dapat dikembalikan untuk revisi berbayar desain/material/produksi |
| Ready stock retur | Kebijakan bisnis: tidak menerima retur; pengecualian cacat/tidak sesuai perlu ditetapkan |
| Pembatalan PO/custom | DP atau pembayaran pertama split hangus |

Retur untuk revisi bukan otomatis refund. Revisi setelah pembayaran 100% tetap dapat dikenai biaya tambahan. Pembatalan setelah pembayaran 100% belum diputuskan.

## 4. Website publik dan sitemap

Navigasi utama: Shop, Collections, Custom & PO, Our Story, Craftsmanship, Contact. Header memiliki pencarian, bahasa, mata uang, akun, dan keranjang. Footer berisi panduan ukuran, perawatan, pengiriman, revisi/retur, pembayaran, privacy, terms, serta kontak.

| Halaman | Isi dan tindakan utama |
|---|---|
| Entrance / landing | 12 chapter cincin 3D silver, identitas putih–graphite, CTA masuk ke store |
| Store homepage | Commercial koleksi silver, kategori, produk unggulan, koleksi, craftsmanship, custom journey, cerita brand |
| Shop | Grid, search, filter kategori/material/ukuran/harga/tipe penjualan, sort, pagination |
| Collection detail | Cerita koleksi dan daftar produk terkait |
| Product detail | Foto/video, 3D bila unggulan, material, berat/dimensi, varian, stok, ukuran, harga, estimasi PO |
| Custom & PO | Penjelasan sampel/revisi, formulir kebutuhan, referensi, CTA WhatsApp |
| Our Story | Identitas, nilai dan cerita brand; klaim harus berasal dari materi brand |
| Craftsmanship | Material, proses, panduan perawatan dan ukuran |
| Cart | Item, varian, kuantitas, harga dan validasi stok |
| Checkout | Alamat, layanan kirim, rincian biaya, metode pembayaran, persetujuan ketentuan |
| Authentication | Google, register, login, email verification, forgot/reset password |
| My Account | Profil, alamat, pesanan, konsultasi, penawaran, sampel, tagihan, revisi |
| Order detail | Timeline pengerjaan, status pembayaran, spesifikasi, invoice, pengiriman |
| Contact/FAQ/Policies | Kontak dan ketentuan operasional dalam dua bahasa |

### PUB-01 Katalog dan produk

Produk memiliki kategori, koleksi, SKU varian, material/kadar bila relevan, warna, ukuran/panjang, berat, jenis batu, engraving bila tersedia, harga, stok, tipe penjualan, foto/video, serta model 3D opsional. Harga dan stok mengikuti varian. Produk tidak aktif tidak dapat dibeli. Stok habis memiliki status jelas.

Search/filter mempertahankan pilihan saat navigasi kembali. Katalog mobile menyediakan filter drawer. Detail produk memberi panduan ukuran dan estimasi pengerjaan PO tanpa mengarang estimasi.

### PUB-02 Akun

Pelanggan boleh browsing tanpa login. Checkout, pengajuan tercatat, persetujuan, dan pembayaran memerlukan akun. Register meminta email/password dan username; alamat dilengkapi sebelum checkout. Akun Google diminta melengkapi profil. Penyatuan akun dengan email sama menggunakan proses verifikasi, tidak dilakukan diam-diam. Satu pelanggan hanya dapat mengakses data miliknya.

Alamat mendukung variasi negara, state, kota, kode pos, telepon, nama penerima, dan beberapa alamat. Pilihan negara bukan janji semua negara bisa dilayani; layanan tersedia mengikuti kemampuan kurir dan barang.

### PUB-03 Ready stock

Pilih varian → cart → login → alamat dan kurir → total biaya → bayar penuh → konfirmasi → picking/packing → kirim → selesai.

Usulan: pisahkan transaksi ready stock dari PO/custom agar estimasi dan tagihan tidak tercampur. Checkout memvalidasi harga/stok kembali dan mereservasi stok selama jendela pembayaran yang dapat diatur. Reservasi dilepas saat expired. Pembayaran bersamaan untuk unit terakhir tidak boleh menghasilkan stok negatif.

### PUB-04 PO dan custom

Pengajuan → konsultasi WhatsApp → spesifikasi dan alamat tujuan → penawaran all-inclusive → persetujuan penawaran/ketentuan → pembayaran awal → sampel → revisi/persetujuan → produksi final → siap kirim → pelunasan → pengiriman.

Form pengajuan mencatat jenis perhiasan, referensi desain, material, ukuran, engraving, anggaran opsional, alamat tujuan, dan catatan. PO bisa menggunakan produk katalog sebagai referensi. WhatsApp memuat nomor pengajuan tanpa mengekspos data sensitif pada URL.

Penawaran berversi memuat spesifikasi, rincian biaya, total all-inclusive, mata uang, masa berlaku, skema pembayaran, estimasi sampel/produksi, serta kebijakan pembatalan dan revisi. Perubahan penawaran mengharuskan persetujuan baru. Harga pesanan yang disetujui dikunci; perubahan alamat/spesifikasi harus diproses sebagai perubahan pesanan yang disetujui.

### PUB-05 Sampel dan revisi

Admin mengunggah foto, spesifikasi, versi sampel, serta resi sampel. Pelanggan memeriksa sampel fisik dan memilih Setujui Sampel atau Ajukan Revisi dengan catatan. Sampel pertama tidak dihitung sebagai revisi. Maksimal tiga putaran revisi gratis; satu permintaan terkirim dengan kumpulan catatan dihitung sebagai satu putaran (usulan definisi).

Persetujuan mencatat pelanggan, versi sampel, spesifikasi material final, ukuran, engraving, waktu, dan versi ketentuan. Sampel berbeda material dari produk final dan perbedaan visual harus dijelaskan. Produksi final diblokir sebelum persetujuan tercatat. Staf tidak boleh menyetujui atas nama pelanggan.

Revisi keempat memerlukan aturan biaya/persetujuan yang belum disahkan. Perubahan setelah persetujuan final membuat change request dan biaya tambahan. Pengembalian barang final untuk revisi memiliki tiket, alasan, foto, keputusan admin, alamat retur, pemeriksaan, penawaran revisi, pembayaran, pengerjaan dan resi kirim ulang.

### PUB-06 Pembayaran

DP awal harus >=20% dari total all-inclusive dan <=total. Split menggunakan 50% + sisa 50%; sisa dihitung total dikurangi pembayaran terverifikasi agar pembulatan tidak menyisakan saldo. Pelanggan dapat melihat total, telah dibayar, sisa, dan tagihan berikutnya.

Untuk contoh total Rp10.000.000: DP minimum Rp2.000.000 dengan sisa Rp8.000.000, atau split Rp5.000.000 + Rp5.000.000. Contoh bersifat ilustrasi.

IDR/USD bukan sekadar label. Sistem menyimpan mata uang pesanan, nominal asli, kurs bila konversi digunakan, waktu kurs, serta nominal settlement gateway. Dukungan QRIS dan mata uang pemrosesan harus diverifikasi pada provider; jangan menampilkan metode yang tidak tersedia. Tidak menyimpan data kartu mentah. Status terverifikasi berasal dari callback/webhook terverifikasi atau mekanisme rekonsiliasi provider, bukan redirect browser saja.

Tampilkan pending, success, failed, expired, dan retry yang aman. Callback berulang tidak menggandakan pembayaran. Kelebihan bayar dan pembayaran setelah expiry masuk review finance, bukan diproses diam-diam.

### PUB-07 Pengiriman internasional

Ready stock: pilih layanan lalu lihat rincian pajak, ongkir, bea masuk dan biaya lain. PO/custom: komponen tersebut ditanggung dalam harga final yang disetujui. Hindari tagihan impor tambahan pada penerima untuk pesanan all-inclusive melalui layanan yang mendukung pembayaran bea oleh pengirim.

Data paket meliputi berat/dimensi, nilai deklarasi, isi/material, negara asal dan klasifikasi kepabeanan yang dikonfirmasi operasional. Semua negara/produk harus diperiksa terhadap cakupan provider. Jika biaya final tidak dapat dihitung lengkap, tampilkan perlu penawaran admin dan blok pembayaran sampai biaya disepakati. Kebijakan selisih estimasi versus biaya aktual harus ditetapkan.

Resi sampel, kiriman final, retur dan revisi adalah kiriman berbeda. Sistem menghindari label duplikat dan mencatat kegagalan booking, retry serta sinkronisasi tracking.

## 5. Dashboard admin

Layout: sidebar berdasarkan izin, topbar pencarian/notifikasi/profil, tabel dengan filter dan pagination, detail dengan tab, serta riwayat aktivitas. Dashboard tidak menggunakan motion scroll dekoratif yang mengganggu pekerjaan.

| Modul | Fitur |
|---|---|
| Overview | Penjualan per mata uang, sisa tagihan, pesanan, sampel, produksi dan kiriman tertunda |
| Produk | CRUD, SKU/varian, status, tipe penjualan, foto/video/3D, unggulan |
| Koleksi | Urutan, cerita bilingual, banner dan produk |
| Material/pricing | Harga acuan, satuan, tanggal, riwayat, biaya pengerjaan dan margin |
| Inventori | Stok tersedia/terreservasi, penyesuaian, histori dan alasan |
| Pelanggan | Profil, alamat, pesanan, pengajuan dan catatan sesuai izin |
| Konsultasi | Pengajuan, penanggung jawab, WhatsApp dan ringkasan |
| Penawaran | Versi, rincian all-inclusive, masa berlaku, skema pembayaran dan persetujuan |
| Pesanan | Filter ready stock/PO/custom, detail, timeline, blokir tindakan tidak valid |
| Sampel | Versi, spesifikasi, foto, kiriman, catatan, counter revisi dan approval |
| Produksi | Antrian, tahapan, penanggung jawab, estimasi, update dan QC |
| Pembayaran | Tagihan awal/pelunasan/revisi, status, rekonsiliasi dan refund yang diizinkan |
| Pengiriman | Paket, layanan, customs, asuransi bila tersedia, booking, resi/tracking |
| Revisi/pembatalan | Tiket, alasan, biaya, persetujuan, dana hangus dan keputusan |
| Konten/CMS | Halaman brand, hero, FAQ, panduan, policy, SEO bilingual |
| Laporan | Penjualan, outstanding, material, revisi, produksi, ekspor sesuai izin |
| Staf dan akses | Akun, peran, izin per modul dan penonaktifan |
| Pengaturan | Negara layanan, mata uang, pembayaran, pengiriman, template notifikasi |
| Audit log | Aktor, waktu, objek, perubahan dan alasan; tidak dapat diedit staf |

## 6. Akses dan izin

Owner mengelola izin lihat, tambah, ubah, hapus, ekspor dan persetujuan per modul. Peran berikut merupakan preset yang dapat diatur, bukan izin mutlak.

| Peran | Akses default | Batas |
|---|---|---|
| Owner | Semua modul | Persetujuan sampel tetap milik pelanggan |
| Sales/CS | Pelanggan, pengajuan, penawaran dan pesanan | Tidak memverifikasi pembayaran/mengatur akses |
| Produksi | Spesifikasi, sampel dan progres | Tanpa laporan keuangan/data pelanggan yang tidak diperlukan |
| Finance | Tagihan, pembayaran, laporan dan review refund | Tanpa perubahan desain/approval pelanggan |
| Katalog/konten | Produk, koleksi, stok dan CMS | Pengubahan harga memerlukan izin terpisah |
| Pengiriman | Pesanan lunas, paket, alamat dan resi | Tidak dapat mengirim pesanan belum lunas |

Pemeriksaan izin dilakukan di Express.js pada endpoint dan objek, bukan hanya menyembunyikan menu. Akun dapat memiliki beberapa peran. Tindakan sensitif direkam; staf dinonaktifkan kehilangan sesi/akses. Audit log dan transaksi historis tidak dihapus lewat CRUD biasa.

## 7. Status dan kontrol proses

Status pengerjaan terpisah dari status pembayaran. Status pembayaran: unpaid, partial, paid, failed, expired, refund_pending, refunded bila berlaku. Status quote: draft, sent, accepted, expired, superseded.

Ready stock: awaiting_payment → confirmed → preparing → ready_to_ship → shipped → delivered. PO/custom: awaiting_agreement → awaiting_initial_payment → sample_in_progress → sample_sent → awaiting_sample_feedback → sample_revision atau sample_approved → final_production → quality_check → ready_to_ship → shipped → delivered.

Cancelled adalah status terminal melalui tindakan berizin dengan alasan. Revision merupakan tiket terpisah yang tidak menghapus sejarah pesanan selesai.

Kontrol wajib: produksi final memerlukan sampel disetujui; pengiriman final memerlukan saldo nol, tagihan tambahan lunas dan QC; status callback tidak boleh mundur akibat event datang tidak berurutan; setiap tindakan yang menambah tagihan memerlukan persetujuan terkait.

## 8. Identitas visual silver, landing page, dan motion

### 8.1 Keputusan brand dan posisi visual

Baseline baru: **Aurelle — Silver Luxury Jewelry**. Karakter visual: modern, elegant, minimalist, precise, tenang, dan premium. Seluruh koleksi serta aset utama menggunakan tampilan logam silver/putih dengan batu yang sesuai katalog. Palet champagne gold, muted gold, warm champagne, dan espresso dari PRD v1.0 digantikan.

Istilah silver adalah arah koleksi dan tampilan logam; jenis material, kadar, plating, berat, dan sertifikasi tetap harus berasal dari spesifikasi produk yang terverifikasi. Jangan menganggap semua produk otomatis sterling silver 925, platinum, atau jenis logam lain. Tidak menambahkan opsi emas sebagai alternatif default. Kombinasi silver dan batu tetap mendukung ready stock, PO, dan custom.

### 8.2 Palet dan pembagian section

| Token | Nilai | Penggunaan |
|---|---|---|
| Pure Black | #000000 | Lockup logo putih, footer, end card |
| Graphite Night | #0E1116 | Background utama hero/showroom dan macro jewelry |
| Charcoal Surface | #191E26 | Surface sekunder gelap, kartu editorial, dialog gelap |
| Pearl White | #F5F7FA | Katalog, formulir, account dan section informatif |
| Pure White | #FFFFFF | Wordmark/logo di background gelap, teks utama gelap, surface terang |
| Platinum Silver | #B8C1CC | Garis, ikon, detail dekoratif dan aksen di surface gelap |
| Slate on Light | #555F6D | Teks sekunder pada surface terang |
| Mist on Dark | #A5AEBA | Teks sekunder pada surface gelap |
| Dark Ink | #151922 | Teks utama dan tombol pada surface terang |
| Frost Blue | #DDE7F2 | Ambient cahaya sekunder yang sangat lembut; bukan warna logam |
| Dark Divider | #353E4B | Garis pembatas dekoratif pada surface gelap |
| Light Divider | #DCE1E8 | Garis pembatas dekoratif pada surface terang |

Rekomendasi komposisi: **hero graphite gelap + store pearl white + craftsmanship charcoal + footer hitam**. Graphite memberi pemisahan visual untuk jewelry putih; surface terang menjaga keterbacaan katalog dan transaksi. Background putih murni boleh digunakan untuk gambar produk jika rim, bayangan, dan pantulan membuat siluet tetap terbaca.

Platinum Silver bukan warna default body text pada Pearl White karena kontrasnya rendah. Gunakan Dark Ink atau Slate on Light untuk teks di surface terang. Warna status success/warning/error tetap memiliki makna operasional dan label; identitas silver tidak mengharuskan seluruh status menjadi abu-abu.

Token UI tidak dipakai mentah sebagai base color material 3D. Material logam dikalibrasi bersama environment, exposure dan roughness. Light/dark adalah pilihan per section yang konsisten, bukan fitur theme switch wajib.

### 8.3 Logo dan tipografi

Logo utama menggunakan monogram A dengan detail kilau berlian dan wordmark AURELLE, dalam warna putih di background hitam. Untuk surface terang gunakan versi Dark Ink dengan bentuk, kerning dan proporsi yang sama. Master aset sebaiknya vector/SVG; PNG transparan disediakan bila diperlukan. Jangan memaksa gambar ber-background hitam menjadi kotak di atas surface terang.

Heading memakai serif editorial elegan; UI, harga, form dan dashboard memakai sans-serif yang mudah dibaca. Teks bilingual dan angka mata uang tetap jelas. Hindari stroke terlalu tipis pada ukuran mobile. Font final belum dipilih dan harus memiliki lisensi yang sesuai.

### 8.4 Ornamen yang diperbolehkan

| Ornamen | Penempatan | Aturan |
|---|---|---|
| Soft spotlight / radial gradient | Di belakang jewelry pada hero | Pusat terang yang lebar dan lembut, tanpa glow tajam di seluruh objek |
| Diamond facet linework | Sudut section editorial/craftsmanship | Garis geometris tipis; tidak melewati harga, headline atau form |
| Contour ring / arc | Transisi antarbab atau background statis | Mengikuti kurva cincin, bukan lingkaran dekoratif yang berlebihan |
| Dark stone / satin texture | Hero atau craftsmanship | Tekstur sangat samar; hindari marmer dengan urat besar yang dominan |
| Studio reflection | Tepian band, pendants dan bangle | Pantulan berasal dari material/cahaya produk; mengikuti bentuk logam |
| Tiny four-point glint | Detail identitas opsional | Satu aksen kecil statis; tidak berkedip tanpa sebab |
| Fine divider dan nomor editorial | Daftar chapter dan pemisah section | Memperkuat ritme konten tanpa menjadi elemen utama |

Hero memakai maksimal dua keluarga ornamen secara bersamaan, misalnya spotlight + facet linework. Produk dan typography tetap dominan. Opacity dekorasi dapat dimulai dari sekitar 4–8%, lalu disesuaikan lewat pemeriksaan kontras dan perangkat nyata. Angka ini usulan desain, bukan pengganti evaluasi visual.

Hindari ornamen gold, bunga besar, crown clip-art, glitter particles, sparkle berulang, lens flare berat, border ornamental yang ramai, glow neon, glassmorphism pada semua kartu, dan gradient silver pada teks panjang. Decorative assets diberi `aria-hidden` dan tidak menghalangi klik/touch.

### 8.5 Struktur entrance dan website publik

Website publik tetap satu surface yang mencakup showroom/landing, store e-commerce dan company profile. Dashboard admin adalah website kedua. Pemisahan entrance dan store tidak mengubahnya menjadi tiga produk terpisah.

| Area | Arah visual dan tindakan |
|---|---|
| Entrance / landing | 12 chapter 3D scroll dengan graphite background, monogram/wordmark putih, CTA Masuk ke Store / Enter the Store yang selalu mudah dicapai |
| Store homepage | Commercial/produk unggulan, kategori cincin/gelang/kalung/anting, featured collections, craftsmanship dan custom journey |
| Shop dan PDP | Pearl White, gambar besar dengan background konsisten, spesifikasi lengkap dan CTA berkontras tinggi |
| Our Story / Craftsmanship | Kombinasi pearl dan charcoal, foto/editorial craftsmanship, klaim material terverifikasi |
| Custom/PO dan My Account | Surface terang dengan status, versi penawaran/sampel dan nominal yang mudah dibandingkan |
| Checkout | Form terang, rincian biaya jelas, motion minimal, harga dan tombol bayar dominan |
| Footer | Pure Black dengan logo putih, navigasi dan kebijakan yang terbaca |

Perpindahan antara section gelap dan terang dirancang dengan pemisah/editorial spacing yang rapi. Jangan membuat flash terang mendadak pada setiap scroll chapter. Background video/3D dan teks harus dirancang bersama; informasi penting tetap dapat dibaca pada setiap frame.

### 8.6 Spesifikasi 3D dan realisme silver

Center ring menggunakan band dan setting berwarna silver/putih, bukan champagne gold. Seluruh prongs, gallery, pavé seats dan beads mengikuti finishing silver yang konsisten. Batu memiliki warna/transparansi sesuai spesifikasi produk; diamond visual memakai facet yang tajam, depth yang jelas dan fire yang terkontrol.

Prioritas visual:

1. Geometri proporsional: band, crown, prongs, gallery dan seats tidak menembus atau mengambang.
2. Material silver dengan kontras pantulan terang/gelap yang memperlihatkan lengkungan. Hindari flat gray, plastik putih, metallic blue atau mirror chrome tanpa detail bentuk.
3. Studio environment netral: softbox besar, strip highlight, fill terkontrol dan dark reflection flags. Warm cast yang membuat logam tampak emas dihindari.
4. Berlian terlihat jernih dengan Fresnel/refraction/internal reflections yang meyakinkan, bukan milk glass atau glow buatan.
5. Exposure menjaga facet dan highlight logam, tanpa clipping luas atau berlian tenggelam dalam background.
6. Camera macro mengikuti detail yang sedang dibahas; depth of field opsional tidak mengaburkan fokus produk atau UI.

Ultra realistis adalah target kualitas visual yang dinilai melalui close-up dan reference comparison, bukan klaim full-scene ray tracing. Teknik rendering dan kompromi performa harus didokumentasikan. UI tidak menerima post-processing blur/bloom dari canvas.

### 8.7 Dua belas chapter scroll

| Chapter | Fokus |
|---|---|
| 01 — First light | Macro pantulan pertama pada diamond |
| 02 — The cut | Table/crown dan struktur facet oval |
| 03 — Floating light | Komposisi batu/fragmen dengan pencahayaan konsisten |
| 04 — The crown | Dudukan, prongs dan silver polish |
| 05 — Suspended | Batu mendekati setting dengan alignment tepat |
| 06 — The embrace | Assembly batu dan setting |
| 07 — Pavé detail | Pavé, seat, beads dan bahu cincin |
| 08 — Beneath the stone | Gallery dan struktur di bawah batu |
| 09 — The silhouette | Siluet cincin utuh |
| 10 — Another perspective | Profil dan rotasi cincin |
| 11 — The whole | Komposisi hero produk utuh |
| 12 — Invitation | Final pose dan ajakan masuk ke store |

Seluruh adegan tangan/jari memasuki cincin dihapus dari entrance 3D. Gunakan satu ring yang konsisten sepanjang journey; scroll turun memajukan pose, berhenti menghentikan gerakan utama, dan scroll naik memulihkan pose. Tidak ada clock terpisah untuk rotasi utama atau glitter. Counter, dots, daftar chapter dan durasi pinned scroll mengikuti jumlah 12 chapter.

Frontend React.js + TypeScript (.tsx), backend Express.js. GSAP ScrollTrigger mengendalikan timeline. ScrollSmoother dan SplitText digunakan hanya jika membantu pengalaman dan tidak bertabrakan dengan input, navigation atau accessibility. Hindari memasang dua sistem smoothing bersamaan. Viewer produk unggulan dikendalikan pengguna dengan rotate/zoom/reset, bukan pinned narrative.

### 8.8 Commercial video dan foto koleksi

Video commercial website menggunakan arah **silver luxury**, bukan warna logam gold. Durasi master acuan 30 detik dengan versi web yang dioptimalkan; komposisi desktop 16:9 dan mobile reframing bila tersedia.

Model commercial yang disepakati: seorang wanita Korea dewasa berusia sekitar 21–25 tahun, rambut hitam alami, mata cokelat gelap, makeup natural, outfit minimalis putih/pearl. Identitas, rambut, mata, wardrobe dan perhiasan konsisten antarscene. Skin texture dan jewelry contact terlihat natural. Tidak menggunakan rambut pirang/mata biru.

Commercial menampilkan cincin, gelang/bangle, kalung/pendant dan anting, lalu komposisi koleksi. Tangan yang memakai perhiasan boleh ada dalam commercial model; larangan adegan tangan berlaku pada narrative 3D entrance yang telah dihapus, bukan pada semua foto/video campaign.

Commercial bukan pengganti 12 chapter scroll. Tampilkan sebagai media pada store homepage atau section campaign; jangan menjalankan video dan canvas berat bersamaan di hero entrance. Typography/wordmark dan CTA ditambahkan sebagai overlay yang tajam, bukan lettering yang ikut digenerate dalam footage. Model komersial tidak mengubah spesifikasi/desain produk katalog.

Video web menyediakan poster, mute-by-default bila autoplay digunakan, kontrol pause/play dan reduced-motion fallback. Playback otomatis tidak boleh menutup akses navigasi atau mengganggu checkout. Persyaratan aksesibilitas motion dipenuhi sesuai konten yang ditampilkan.

### 8.9 Dashboard admin

Admin memakai Pearl White sebagai background utama, surface putih, sidebar Dark Ink/Graphite dengan logo putih, garis abu-abu bersih, dan teks Dark Ink. Silver hanya aksen terbatas; tabel, form, harga dan status tidak menggunakan efek metallic.

Dashboard tidak mengikuti pinned cinematic scroll atau video autoplay. Grafis dan warna status harus disertai label/icon; visibility akses tetap dikendalikan backend sesuai bagian 6. Preview aset di CMS boleh memakai dark/light background untuk memeriksa siluet jewelry.

### 8.10 Responsiveness, aksesibilitas dan quality tiers

Hero menjaga negative space untuk headline dan CTA; framing mobile dirancang khusus agar center stone tidak tertutup UI atau terpotong. Logo, navigation, harga dan form tetap terbaca. Target kontras teks biasa minimal 4.5:1 dan teks besar 3:1; kontras setiap pasangan nyata diperiksa, termasuk overlay pada frame video/3D. Ornamen dekoratif bukan pengganti teks/status/focus indicator.

Aset 3D/video dimuat lazy sesuai lokasi dengan poster dan fallback. Mode ringan menurunkan pixel ratio, optical bounce budget dan efek opsional. Jika rendering gagal, tampilkan foto dan tetap izinkan akses store. Reduced motion meniadakan smoothing dan reveal yang menghambat isi, serta memakai pose/poster yang tenang. Keyboard, anchor, dialog dan input tidak terhambat animasi.

Target FPS, ukuran file, dan performa dinilai pada perangkat uji dengan aset nyata. Jangan mengklaim benchmark yang belum diukur. Build, TypeScript, shader compile, forward/reverse scroll, chapter jump, resize, pause/play dan teardown diperiksa sebelum release.

### 8.11 Migrasi aset dan dokumentasi

| Komponen | Pembaruan wajib |
|---|---|
| Theme/CSS tokens | Hapus baseline warm gold dan ganti token silver-dark/pearl |
| 3D ring | Semua logam silver, evaluasi material dan environment netral |
| Foto/video/poster | Koleksi silver dengan pencahayaan dan crop yang konsisten |
| Logo | Putih pada hitam/graphite; versi Dark Ink untuk surface terang |
| CMS | Simpan provenance, material aktual, alt text bilingual dan preview aset |
| Copy | Hapus deskripsi emas/champagne gold bila tidak sesuai produk |
| Wireframe/prompts berikutnya | Mengikuti PRD v2.0; arahan gold terdahulu tidak menjadi baseline |
| Admin | Surface terang, sidebar gelap, tanpa ornamen cinematic |

PRD ini merupakan spesifikasi desain/implementasi. Perubahan source website, aset commercial dan dokumen prompt terpisah dilakukan dalam pekerjaan implementasi masing-masing; revisi PRD bukan bukti bahwa semua aset tersebut sudah dimigrasikan.

Referensi aksesibilitas: [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) dan [W3C — Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).


## 9. Arsitektur dan data

Dua frontend terpisah secara deployment/routing: publik dan admin. Keduanya memakai API Express.js bersama. Database relasional merupakan usulan untuk konsistensi stok, pembayaran dan hubungan data; vendor/database final belum dipilih. Media disimpan pada object storage dengan akses sesuai klasifikasi.

Entitas utama: User, Profile, Address, StaffRole, Permission, Product, Variant, Collection, MaterialPrice, InventoryMovement, Reservation, CustomRequest, Quote, QuoteVersion, Order, OrderItem, SpecificationSnapshot, SampleVersion, SampleFeedback, Approval, ProductionTask, Invoice, Payment, PaymentEvent, ChangeRequest, Shipment, RevisionTicket, Cancellation, ContentTranslation, CurrencyRate dan AuditLog.

Nominal uang menggunakan integer minor units/decimal terkontrol, bukan float. Order menyimpan snapshot harga, alamat dan spesifikasi. Transaksi stok dan pembayaran atomik. Relasi proposal, persetujuan dan sampel harus menunjuk versi tertentu.

API domain: auth/profile, catalog, cart/checkout, requests/quotes, orders/samples/approvals, invoices/payments, shipments, revisions, admin/content, admin/roles/audit. Endpoint gateway/kurir memverifikasi asal event. Kunci API dan secret berada di server.

Integrasi yang dibutuhkan: Google identity, email transaksional, payment gateway, kurir domestik/internasional, kalkulasi biaya impor, media storage. Provider belum dipilih; tidak menganggap satu provider memenuhi semua negara, material, mata uang dan metode.

## 10. Notifikasi

Email dan notifikasi akun untuk: akun/verifikasi/reset, quote baru/expired, pembayaran sukses/gagal/expired, sampel dikirim, feedback dan persetujuan, update produksi, siap kirim/pelunasan, shipment, delivery, biaya revisi dan pembatalan. Bahasa mengikuti preferensi pengguna. WhatsApp otomatis bukan scope yang disepakati. Job retry tidak mengirim pesan duplikat.

## 11. Persyaratan kualitas

Responsif pada desktop/tablet/mobile; keyboard, label form, fokus terlihat dan kontras diuji. Target awal: WCAG AA pada alur utama; Core Web Vitals mobile LCP <=2,5 detik, INP <=200 ms, CLS <=0,1 pada halaman utama dengan aset representatif (target implementasi).

SEO publik: metadata bilingual, URL bahasa konsisten, hreflang, sitemap, canonical dan structured product data sesuai isi. Strategi rendering/indexability diputuskan saat arsitektur; tidak menganggap SPA otomatis memenuhi SEO. Admin tidak diindeks.

Keamanan: session aman, validasi input, rate limiting auth, password hash, CSRF bila menggunakan cookie, pemeriksaan kepemilikan, sanitasi unggahan dan akses media privat. Usulan MFA untuk staf. Tidak merekam password/token/kartu dalam log.

Operasional: backup dan uji restore, observability callback, error monitoring, rekonsiliasi pembayaran, job retry, audit perubahan. Jadwal backup dan target pemulihan ditentukan sebelum peluncuran.

## 12. Acceptance criteria utama

| ID | Kriteria terukur |
|---|---|
| AC-01 | Pengunjung dapat browsing tetapi tidak menyelesaikan checkout tanpa login |
| AC-02 | Login Google dan email menghasilkan profil/alamat yang dapat dikelola |
| AC-03 | Ready stock tidak menawarkan DP/split dan total menampilkan rincian biaya |
| AC-04 | Dua checkout unit terakhir tidak menghasilkan stok negatif |
| AC-05 | PO/custom menyimpan penawaran all-inclusive dan versi persetujuan |
| AC-06 | DP 19% ditolak; 20% diterima; split pertama 50% dan saldo dihitung tepat |
| AC-07 | Produksi final diblokir sebelum pelanggan menyetujui sampel |
| AC-08 | Counter revisi sampel terlihat dan revisi keempat tidak otomatis gratis |
| AC-09 | Callback pembayaran duplikat tidak menggandakan nominal/transaksi |
| AC-10 | Pengiriman diblokir saat masih ada saldo atau biaya tambahan belum lunas |
| AC-11 | Pelanggan lain/staf tanpa izin ditolak oleh API meskipun menebak ID |
| AC-12 | Perubahan harga material tidak mengubah pesanan disetujui |
| AC-13 | IDR/USD memiliki nominal, kurs bila berlaku dan mata uang pemrosesan yang jelas |
| AC-14 | Negara tanpa kalkulasi lengkap tidak dapat membayar total yang menyesatkan |
| AC-15 | Sampel, kiriman final, retur dan revisi menyimpan resi terpisah |
| AC-16 | 3D gagal tetap menampilkan foto dan tidak menghambat pembelian |
| AC-17 | Reduced motion, mobile dan keyboard dapat menyelesaikan alur utama |
| AC-18 | Persetujuan pelanggan serta perubahan pembayaran/harga tercatat dalam audit |
| AC-19 | Koleksi, copy, foto, poster, video, 3D dan UI mengikuti konsep silver; tidak ada baseline aksen gold yang tertinggal |
| AC-20 | Logo utama putih pada background hitam/graphite; versi surface terang terbaca dengan proporsi konsisten |
| AC-21 | Entrance memiliki 12 chapter tanpa adegan tangan; counter, nav, replay dan reverse scroll konsisten |
| AC-22 | Jewelry silver tetap memiliki siluet yang jelas pada dark/light layout desktop dan mobile |
| AC-23 | Maksimal dua keluarga ornamen pada hero; dekorasi tidak menutup teks, produk atau CTA |
| AC-24 | Teks/CTA/focus diperiksa pada background aktual; Platinum Silver tidak menjadi body text di Pearl White |
| AC-25 | Commercial menampilkan koleksi silver dan model Korea dewasa berambut hitam, bermata cokelat gelap dengan continuity produk/identitas |
| AC-26 | Video menyediakan pause/play, poster dan reduced-motion fallback; tidak berjalan bersamaan dengan canvas berat pada hero entrance |
| AC-27 | Dashboard memakai theme operasional yang jelas dan tidak menjalankan pinned cinematic motion |

## 13. Tahapan implementasi

1. Finalisasi keputusan terbuka, wireframe dua website, model data dan uji kemampuan provider.
2. Fondasi auth, akses, katalog, CMS bilingual, harga/inventori dan aset visual.
3. Ready stock, checkout internasional, pembayaran, kurir dan rekonsiliasi.
4. PO/custom, quote all-inclusive, sampel/revisi, produksi dan pelunasan.
5. Hero/produk unggulan 3D, motion, laporan dan hardening.
6. UAT end-to-end, sandbox callback/kurir, accessibility, performa, backup/restore dan persiapan operasional.

Semua alur bisnis yang disepakati menjadi cakupan rilis penuh; tahapan adalah urutan pengerjaan, bukan penghapusan fitur.

## 14. Keputusan terbuka sebelum peluncuran

- Pembatalan PO/custom yang sudah dibayar 100%: pemotongan dan refund belum ditetapkan.
- Kesalahan produksi, cacat, barang tidak sesuai dan kerusakan pengiriman: penanganan dan pengecualian policy retur belum disepakati. Kebijakan perlu ditinjau sesuai pasar tujuan sebelum dipublikasikan; ini bukan kesimpulan hukum.
- Revisi sampel keempat, revisi yang disebabkan kesalahan Aurelle, serta biaya pengiriman retur/kirim ulang.
- Cakupan biaya sampel: produksi, ongkir, impor, pengembalian sampel, dan kepemilikan sampel.
- Tenggat pelunasan, quote validity, lama reservasi stok, estimasi produksi dan aturan keterlambatan.
- Negara peluncuran, carrier/gateway, penerimaan perhiasan/logam mulia, asuransi dan kalkulasi bea.
- IDR/USD: kurs/harga per mata uang, provider settlement, pembulatan dan metode tersedia.
- Penanggung selisih bea/ongkir aktual untuk ready stock dan prosedur pembayaran ulang.
- Revisi/batal setelah pengiriman, harga material saat change request, serta aturan pajak invoice.
- Domain/legalitas merek Aurelle, file master aset final, foto/video, model 3D dan font final. Nama Aurelle dan arah silver telah dipilih.
- Jenis/kadar material silver, finishing/plating, spesifikasi batu dan sertifikasi tiap SKU; tidak disimpulkan hanya dari warna visual.
- Finalisasi provider/perangkat uji dan anggaran aset untuk memenuhi target realisme/performa; lokasi commercial pada store ditinjau saat wireframe.

Keputusan terbuka tidak boleh ditampilkan sebagai aturan final. Fitur finansial yang belum memiliki policy lengkap harus dibatasi sampai keputusan disahkan.

## 15. Riwayat revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 7 Oktober 2026 | Baseline dua website, aturan e-commerce, PO/custom dan akses admin |
| 2.0 | 12 Oktober 2026 | Konsep seluruh brand ke silver/white jewelry; graphite–pearl palette; logo putih; ornamen minimal; 12 chapter tanpa tangan; commercial model Korea; admin theme dan migration checklist. Aturan transaksi, pembayaran, sampel, pengiriman dan izin tetap dipertahankan. |
