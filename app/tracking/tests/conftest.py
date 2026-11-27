"""Test berjalan di PostgreSQL lokal terpisah (docker-compose.test.yml, port 5434), tidak pernah
di Supabase. Skema dibuat oleh migration Alembic yang sama dengan production, sehingga
migration ikut teruji. Biteship dan OSRM dipalsukan dengan respx: tidak ada request keluar.
"""
import os
from collections.abc import AsyncIterator, Callable
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://tracking:tracking@127.0.0.1:5434/tracking_test")
if urlsplit(TEST_DATABASE_URL).hostname not in ("127.0.0.1", "localhost", "postgres-test"):
    raise RuntimeError("TEST_DATABASE_URL harus menunjuk PostgreSQL lokal. Test menghapus isi tabel: jangan pernah diarahkan ke Supabase.")

# Harus diisi sebelum `app` diimpor. Nilai di environment mengalahkan file .env, jadi tidak ada
# rahasia atau alamat sungguhan dari .env yang terpakai di test.
os.environ.update(
    DATABASE_URL=TEST_DATABASE_URL,
    DATABASE_URL_MIGRATION=TEST_DATABASE_URL,
    DATABASE_SSL="disable",
    BITESHIP_API_KEY="biteship_test.kunci_palsu",
    BITESHIP_BASE_URL="https://api.biteship.com",
    BITESHIP_WEBHOOK_HEADER="X-Webhook-Secret",
    BITESHIP_WEBHOOK_SECRET="",
    SUPABASE_URL="",
    SUPABASE_SERVICE_ROLE_KEY="",
    ADMIN_API_TOKEN="token-admin-test",
    APP_BASE_URL="http://test",
    TIMEZONE="Asia/Jakarta",
    OSRM_BASE_URL="https://router.project-osrm.org",
    SYNC_INTERVAL_MINUTES="10",
    FORCE_SYNC_COOLDOWN_SECONDS="30",
)

import httpx  # noqa: E402
import pytest  # noqa: E402
import respx  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.main import create_app  # noqa: E402
from app.models import Shipment  # noqa: E402

PROJECT_DIR = Path(__file__).resolve().parents[1]
BITESHIP = "https://api.biteship.com"
OSRM = "https://router.project-osrm.org"
DEPOK = (-6.4025, 106.7942)
CIREBON = (-6.7320, 108.5523)
# Rute pendek buatan: 3 titik dari Depok ke Cirebon, sebagai [lat, lng].
ROUTE = [[DEPOK[0], DEPOK[1]], [-6.55, 107.6], [CIREBON[0], CIREBON[1]]]


@pytest.fixture(scope="session")
def schema() -> None:
    """Jalankan migration Alembic sekali per sesi test (di luar event loop)."""
    command.upgrade(Config(str(PROJECT_DIR / "alembic.ini")), "head")


@pytest.fixture
async def app(schema: None) -> AsyncIterator:
    application = create_app()
    async with application.router.lifespan_context(application):
        async with application.state.engine.begin() as connection:
            await connection.execute(text("TRUNCATE shipments, shipment_histories, drivers RESTART IDENTITY CASCADE"))
        yield application


@pytest.fixture
async def client(app) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as http:
        yield http


@pytest.fixture
async def session(app) -> AsyncIterator[AsyncSession]:
    async with app.state.sessionmaker() as db:
        yield db


@pytest.fixture
def mock_http() -> AsyncIterator[respx.MockRouter]:
    """Semua request httpx keluar harus terdaftar di sini; yang tidak terdaftar gagal."""
    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.fixture
def make_shipment(app) -> Callable[..., "Shipment"]:
    async def factory(**overrides) -> Shipment:
        now = datetime.now(timezone.utc)
        values = dict(
            no_resi="11-SJ-26-000411", via="darat", layanan="Retailer", layanan_keterangan="Regular (Key)",
            pengirim_nama="PT Sumber Makmur", alamat_muat="Jl. Margonda Raya, Depok", muat_lat=DEPOK[0], muat_lng=DEPOK[1],
            penerima_nama="Toko Sinar", alamat_bongkar="Jl. Siliwangi, Cirebon", bongkar_lat=CIREBON[0], bongkar_lng=CIREBON[1],
            koli=12, ikat=4, qty=320, berat_kg=26910,
            tanggal_muat=date(2026, 1, 8), estimasi_tiba=(now + timedelta(days=1)).date(), lead_time_hari=1,
            jarak_km=190.4, route_geometry=ROUTE, status_terakhir="confirmed", status_terakhir_at=now,
        )
        values.update(overrides)
        async with app.state.sessionmaker() as db:
            shipment = Shipment(**values)
            db.add(shipment)
            await db.commit()
            return shipment

    return factory


def order_json(status: str, order_id: str = "ord_1", tracking_id: str = "trk_1", **courier) -> dict:
    """Jawaban GET /v1/orders/{id}, sebatas field yang dipakai aplikasi."""
    return {
        "success": True, "object": "order", "id": order_id, "status": status,
        "courier": {"tracking_id": tracking_id, "waybill_id": "WYB-1700000000001", "company": "jne", "type": "reg", "driver_name": None, **courier},
        "field_baru_dari_biteship": {"apa": "saja"},
    }


def tracking_json(status: str, history: list[tuple[str, str, str]], tracking_id: str = "trk_1") -> dict:
    """Jawaban GET /v1/trackings/{id}. `history`: (status, updated_at, note)."""
    return {
        "success": True, "object": "tracking", "id": tracking_id, "waybill_id": "WYB-1700000000001", "status": status,
        "courier": {"company": "jne"},
        "history": [{"status": s, "updated_at": at, "note": note, "service_type": "reg"} for s, at, note in history],
    }
