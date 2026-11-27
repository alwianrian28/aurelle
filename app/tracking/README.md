# Tracking Pengiriman

Halaman publik untuk melacak pengiriman dengan No. Resi: ringkasan status, detail muatan,
peta perkiraan posisi, informasi driver, dan riwayat pengiriman.
FastAPI + PostgreSQL (Supabase) + Biteship.

Service ini berdiri sendiri di `app/tracking/` dan tidak memakai kode `app/backend/`
(Aurelle API). Semua perintah di bawah dijalankan dari folder `app/tracking/`.

> **Posisi kendaraan di peta adalah perkiraan, bukan GPS.** Kurir reguler (mis. JNE REG)
> hanya melaporkan status per checkpoint tanpa koordinat. Posisi dihitung dari status dan
> waktu di sepanjang rute jalan (`app/domain/position.py`) dan selalu diberi label
> "Perkiraan posisi berdasarkan status pengiriman".

## Struktur

```
app/
  main.py              create_app, lifespan (satu httpx client + satu engine)
  cli.py               seed, create-test-order, sync, setup-storage
  core/                config.py (.env), db.py (engine Supabase), logging.py
  models/              SQLAlchemy: shipments, shipment_histories, drivers
  schemas/             Pydantic: response Biteship, TrackingResponse, WebhookPayload
  services/            biteship.py, osrm.py, storage.py, tracking.py (orkestrasi)
  domain/              status.py (pemetaan status), position.py (posisi estimasi), formatting.py
  api/                 routes_pages.py, routes_api.py, routes_webhook.py
  templates/           base.html, tracking.html, partials/
  static/              js/tracking-map.js, js/tracking-page.js, css/tracking.css
alembic/               migration (satu-satunya sumber skema)
tests/
```

## Setup dari nol

### 1. Dependency

```bash
cd app/tracking
python -m venv .venv
.venv\Scripts\activate          # Windows;  macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

Dengan uv: `uv venv && uv pip install -r requirements-dev.txt`.

### 2. File .env

```bash
copy .env.example .env          # macOS/Linux: cp .env.example .env
```

| Variabel | Diambil dari |
|---|---|
| `BITESHIP_API_KEY` | Dashboard Biteship: nyalakan **Testing Mode**, lalu buat API key. Key sandbox berawalan `biteship_test.` dan hanya ditampilkan sekali |
| `DATABASE_URL` | Supabase > **Connect** > Transaction pooler (port **6543**). Ganti awalan menjadi `postgresql+asyncpg://` |
| `DATABASE_URL_MIGRATION` | Supabase > **Connect** > Session pooler (port **5432**) atau Direct connection, awalan `postgresql+asyncpg://` |
| `SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > `service_role` (rahasia) |
| `BITESHIP_WEBHOOK_HEADER` / `_SECRET` | Anda tentukan sendiri, lalu isikan nilai yang sama di dashboard Biteship (langkah 7) |
| `ADMIN_API_TOKEN` | Anda tentukan sendiri. Kosong = input history manual dimatikan |

Password database yang mengandung karakter khusus harus di-URL-encode
(`@` menjadi `%40`, `#` menjadi `%23`, `/` menjadi `%2F`, dan seterusnya).

### 3. Skema database

```bash
alembic upgrade head
```

Migration membuat ketiga tabel dan menjalankan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
untuk setiap tabel (termasuk `alembic_version`), tanpa policy apa pun.

### 4. Bucket foto bukti

```bash
python -m app.cli setup-storage
```

Membuat bucket **privat** `shipment-photos`. Cara manual: Supabase > Storage > New bucket,
nama `shipment-photos`, **Public bucket dimatikan**.

### 5. Data contoh

```bash
python -m app.cli seed
```

Membuat pengiriman `11-SJ-26-000411` Depok ke Cirebon dengan 5 history dan mengambil rute
jalan dari OSRM (disimpan di `route_geometry`, tidak diambil lagi di setiap request).

### 6. Jalankan

```bash
uvicorn app.main:app --reload
```

Buka <http://localhost:8000/tracking/11-SJ-26-000411>. Port 8000 juga dipakai Aurelle API;
bila keduanya berjalan, tambahkan `--port 8001` dan sesuaikan `APP_BASE_URL`.

### 7. Webhook Biteship (lokal lewat ngrok)

```bash
ngrok http 8000
```

Di dashboard Biteship (Testing Mode), buka halaman pengaturan webhook dan tambahkan webhook baru
(letak menunya bisa berubah; lihat <https://biteship.com/en/docs/api/webhook/add_webhook>).

- URL: `https://<alamat-ngrok>/api/webhooks/biteship`
- Event: `order.status` dan `order.waybill_id`
- Signature key: isi `BITESHIP_WEBHOOK_HEADER` (mis. `X-Webhook-Secret`)
- Signature secret: isi `BITESHIP_WEBHOOK_SECRET`

Saat disimpan, Biteship mengirim POST uji ber-body kosong dan hanya menyimpan webhook bila
dijawab 2xx. Endpoint ini menjawab 200 untuk ping tersebut.

## Skenario uji manual

1. `python -m app.cli seed`, lalu catat `id` yang dicetak.
2. `python -m app.cli create-test-order <id>`
   Membuat order simulasi di Biteship dan menyimpan `order_id`, `tracking_id`, `waybill_id`.
   History contoh dihapus supaya riwayat hanya berisi data Biteship
   (`--no-reset-history` untuk mempertahankannya).
3. Buka halaman tracking. Status "Dikonfirmasi", kendaraan di titik muat (progress 0).
4. Di dashboard Biteship buka order tersebut, klik **Update Status**, pilih `picked`.
   Webhook masuk; muat ulang halaman: history bertambah, kendaraan bergeser 5% dari titik muat.
5. Ubah ke `dropping_off`: garis biru "Dalam Perjalanan" memanjang mengikuti waktu
   (maksimal 95% sampai benar-benar `delivered`).
6. Ubah ke `delivered`: garis menjadi hijau "Sudah Dilewati", kendaraan di titik bongkar.
7. Tanpa webhook: tekan tombol refresh di kanan atas, atau `python -m app.cli sync <no_resi>`.

Override data driver (kurir reguler tidak mengirimnya): isi satu baris di tabel `drivers`
untuk `shipment_id` yang bersangkutan.

Input history manual dengan foto:

```bash
curl -X POST http://localhost:8000/api/shipments/11-SJ-26-000411/histories \
  -H "X-Admin-Token: <ADMIN_API_TOKEN>" \
  -F status=delivered -F posisi=Cirebon -F "memo=Diterima oleh Budi" -F foto=@bukti.jpg
```

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/tracking` | Form kosong |
| GET | `/tracking/{no_resi}` | Halaman tracking. Sinkron dari Biteship bila data lebih tua dari 10 menit |
| GET | `/api/tracking/{no_resi}` | JSON yang sama (`TrackingResponse`). `?force=true` memaksa sinkron, maksimal sekali per 30 detik |
| POST | `/api/shipments/{no_resi}/histories` | History manual (multipart, foto JPEG/PNG/WebP maks. 5 MB). Wajib header `X-Admin-Token` |
| POST | `/api/webhooks/biteship` | Webhook Biteship |
| GET | `/healthz` | `SELECT 1` ke database |

## Keamanan

- **RLS menyala tanpa policy** di semua tabel: akses lewat Supabase Data API (anon key)
  tertutup total. FastAPI tetap bisa membaca dan menulis karena terhubung sebagai role
  `postgres`, yang tidak dibatasi RLS. Setiap migration baru yang membuat tabel wajib
  menyalakan RLS juga (ada pengingat di `alembic/script.py.mako`).
- API key Biteship, `service_role` key, dan connection string hanya ada di server. Browser
  hanya menerima HTML/JSON hasil olahan dan signed URL foto yang kedaluwarsa dalam 1 jam.
- Engine memakai `NullPool` dan mematikan prepared statement cache, sesuai Transaction
  pooler Supavisor.
- Webhook diperlakukan sebagai pemberitahuan: status dan riwayat dibaca ulang dari Biteship
  dengan API key kita, jadi webhook palsu tidak bisa mengisi data karangan.
- Log berbentuk JSON dan tidak pernah memuat key, secret, atau connection string.

## Test

Test memakai PostgreSQL lokal terpisah dan menolak berjalan bila `TEST_DATABASE_URL` tidak
menunjuk localhost. Biteship dan OSRM dipalsukan dengan respx.

```bash
docker compose -f docker-compose.test.yml up -d
pytest
docker compose -f docker-compose.test.yml down
```

## Pindah ke production

Ganti `BITESHIP_API_KEY` dengan key `biteship_live.`; tidak ada perubahan kode. Badge
"Sandbox" otomatis berganti "Tersinkron". Isi `BITESHIP_WEBHOOK_SECRET`, dan daftarkan ulang
webhook dengan alamat production.

## Catatan implementasi

- Nama field Biteship diverifikasi terhadap <https://biteship.com/en/docs/api> (orders
  create/retrieve, trackings retrieve, webhook overview). Satu hal yang belum bisa
  dipastikan dari docs: contoh payload webhook di sana bukan JSON yang valid, jadi nama
  field `WebhookPayload` ditandai `# TODO` untuk dicek terhadap webhook sandbox asli.
- Docs Biteship mencantumkan status `in_transit` (middle mile). Status ini diperlakukan
  sama dengan `dropping_off`.
- Kolom tambahan di luar spesifikasi awal: `shipments.progress_terakhir` (posisi terakhir
  untuk `on_hold` / retur / status tak dikenal), `shipments.kurir_driver_*` (data driver
  dari Biteship), dan `shipment_histories.posisi` (kolom POSISI di tabel history).
