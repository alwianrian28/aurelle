"""Perintah baris: python -m app.cli <perintah>

  seed                          contoh pengiriman Depok -> Cirebon + 5 history
  create-test-order <id>        buat order di Biteship (simulasi bila key sandbox)
  sync <no_resi>                sinkron manual dari Biteship
  setup-storage                 buat bucket privat untuk foto bukti
"""
import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import timedelta
from decimal import Decimal
from typing import Annotated, TypeVar

import httpx
import typer
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import create_engine, create_sessionmaker
from app.domain import formatting as fmt
from app.main import build_deps
from app.models import Shipment, ShipmentHistory
from app.services.biteship import BiteshipError
from app.services.osrm import OsrmError
from app.services.tracking import Deps, Remote, apply_remote, ensure_route, get_shipment, insert_history, sync_shipment, utcnow

cli = typer.Typer(help=__doc__, no_args_is_help=True, add_completion=False)
T = TypeVar("T")

SEED_RESI = "11-SJ-26-000411"
# Koordinat asli pusat kota Depok dan Cirebon.
DEPOK = (-6.4025, 106.7942)
CIREBON = (-6.7320, 108.5523)


@asynccontextmanager
async def runtime() -> AsyncIterator[tuple[AsyncSession, Deps]]:
    """Session DB + klien, dibuka dan ditutup untuk satu perintah."""
    settings = get_settings()
    engine = create_engine(settings)
    try:
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as http, create_sessionmaker(engine)() as session:
            yield session, build_deps(settings, http)
    finally:
        await engine.dispose()


def run(job: Callable[[], Awaitable[T]]) -> T:
    return asyncio.run(job())  # type: ignore[arg-type]


@cli.command()
def seed(force: Annotated[bool, typer.Option("--force", help="Hapus contoh yang sudah ada lalu buat ulang.")] = False) -> None:
    """Buat 1 contoh pengiriman Depok -> Cirebon dengan 5 history (sedang dalam perjalanan)."""

    async def job() -> None:
        async with runtime() as (session, deps):
            tz = deps.settings.TIMEZONE
            existing = await get_shipment(session, SEED_RESI)
            if existing and not force:
                typer.echo(f"Contoh {SEED_RESI} sudah ada (pakai --force untuk membuat ulang).")
                return
            if existing:
                await session.delete(existing)
                await session.commit()

            now = utcnow()
            today = fmt.to_local(now, tz).date()
            shipment = Shipment(
                no_resi=SEED_RESI, via="darat", layanan="Retailer", layanan_keterangan="Regular (Key)",
                courier_company="jne", courier_service="reg",
                pengirim_nama="PT Sumber Makmur Depok", alamat_muat="Jl. Margonda Raya No. 100, Depok, Jawa Barat",
                muat_lat=DEPOK[0], muat_lng=DEPOK[1],
                penerima_nama="Toko Sinar Cirebon", alamat_bongkar="Jl. Siliwangi No. 45, Cirebon, Jawa Barat",
                bongkar_lat=CIREBON[0], bongkar_lng=CIREBON[1],
                koli=12, ikat=4, qty=320, berat_kg=Decimal("26910"),
                tanggal_muat=today, estimasi_tiba=today + timedelta(days=1), lead_time_hari=1,
                status_terakhir="dropping_off", status_terakhir_at=now - timedelta(hours=2),
                picked_at=now - timedelta(hours=3), progress_terakhir=0.05,
            )
            session.add(shipment)
            await session.flush()
            histories = [
                ("confirmed", 5.0, "Depok", "Order dibuat dan dikonfirmasi."),
                ("allocated", 4.5, "Depok", "Kurir sudah dialokasikan."),
                ("picking_up", 4.0, "Depok", "Kurir menuju gudang pengirim."),
                ("picked", 3.0, "Depok", "Barang selesai dimuat, dokumen lengkap."),
                ("dropping_off", 2.0, "Tol Cikampek", "Kendaraan berangkat menuju Cirebon lewat Tol Cikopo-Palimanan."),
            ]
            for status, hours_ago, posisi, memo in histories:
                await insert_history(session, shipment.id, status, now - timedelta(hours=hours_ago), "manual", memo=memo, posisi=posisi)
            await session.commit()
            await session.refresh(shipment)
            try:
                await ensure_route(session, shipment, deps.osrm)
                typer.echo(f"Rute OSRM tersimpan: ± {shipment.jarak_km} km.")
            except OsrmError as error:
                typer.echo(f"Peringatan: {error}. Rute akan dicoba lagi saat halaman dibuka.")
            typer.echo(f"Contoh dibuat: id={shipment.id}, no_resi={shipment.no_resi}")
            typer.echo(f"Buka {deps.settings.APP_BASE_URL.rstrip('/')}/tracking/{shipment.no_resi}")

    run(job)


@cli.command("create-test-order")
def create_test_order(
    shipment_id: Annotated[int, typer.Argument(help="Kolom id di tabel shipments.")],
    courier: Annotated[str, typer.Option(help="Kode kurir Biteship.")] = "jne",
    service: Annotated[str, typer.Option(help="Kode layanan kurir.")] = "reg",
    origin_phone: Annotated[str, typer.Option(help="Telepon pengirim.")] = "081234567890",
    destination_phone: Annotated[str, typer.Option(help="Telepon penerima.")] = "081298765432",
    origin_postal: Annotated[int, typer.Option(help="Kode pos titik muat (default: Depok).")] = 16431,
    destination_postal: Annotated[int, typer.Option(help="Kode pos titik bongkar (default: Cirebon).")] = 45111,
    weight_gram: Annotated[int, typer.Option(help="Berat paket yang dilaporkan ke kurir, gram.")] = 1000,
    value: Annotated[int, typer.Option(help="Nilai barang, rupiah.")] = 100000,
    reset_history: Annotated[bool, typer.Option(help="Hapus history lama supaya riwayat hanya berisi data Biteship.")] = True,
    yes: Annotated[bool, typer.Option("--yes", help="Lewati konfirmasi saat memakai key production.")] = False,
) -> None:
    """Buat order di Biteship untuk sebuah shipment, lalu simpan order_id, tracking_id dan waybill_id.

    Koordinat titik muat dan bongkar selalu dikirim (origin_coordinate, destination_coordinate).
    Kurir reguler juga membutuhkan kode pos. Berat default 1 kg karena muatan truk sungguhan
    (puluhan ton) akan ditolak kurir paket.
    """

    async def job() -> None:
        async with runtime() as (session, deps):
            shipment = (await session.execute(select(Shipment).where(Shipment.id == shipment_id))).scalar_one_or_none()
            if shipment is None:
                typer.echo(f"Shipment id={shipment_id} tidak ditemukan.", err=True)
                raise typer.Exit(1)
            if None in (shipment.muat_lat, shipment.muat_lng, shipment.bongkar_lat, shipment.bongkar_lng):
                typer.echo("Shipment belum punya koordinat titik muat / bongkar.", err=True)
                raise typer.Exit(1)
            if not deps.biteship.is_sandbox and not yes:
                typer.confirm("BITESHIP_API_KEY bukan key sandbox: order ini SUNGGUHAN dan memotong saldo. Lanjutkan?", abort=True)

            # reference_id harus unik per order di Biteship, jadi diberi cap waktu.
            reference = f"{shipment.no_resi}-{utcnow():%Y%m%d%H%M%S}"
            payload = {
                "shipper_contact_name": shipment.pengirim_nama or "Pengirim",
                "shipper_contact_phone": origin_phone,
                "origin_contact_name": shipment.pengirim_nama or "Pengirim",
                "origin_contact_phone": origin_phone,
                "origin_address": shipment.alamat_muat or "-",
                "origin_postal_code": origin_postal,
                "origin_coordinate": {"latitude": shipment.muat_lat, "longitude": shipment.muat_lng},
                "destination_contact_name": shipment.penerima_nama or "Penerima",
                "destination_contact_phone": destination_phone,
                "destination_address": shipment.alamat_bongkar or "-",
                "destination_postal_code": destination_postal,
                "destination_coordinate": {"latitude": shipment.bongkar_lat, "longitude": shipment.bongkar_lng},
                "courier_company": courier,
                "courier_type": service,
                "delivery_type": "now",
                "order_note": f"Tes tracking {shipment.no_resi}",
                "reference_id": reference,
                "items": [{"name": f"Muatan {shipment.no_resi}", "description": "Order tes", "category": "others", "value": value, "quantity": 1, "weight": weight_gram}],
            }
            try:
                order = await deps.biteship.create_order(payload)
            except BiteshipError as error:
                typer.echo(f"Biteship menolak order: {error.message} (HTTP {error.status}, kode {error.code})", err=True)
                raise typer.Exit(1) from error
            if not order.id:
                typer.echo("Biteship tidak mengembalikan id order.", err=True)
                raise typer.Exit(1)

            now = utcnow()
            if reset_history:
                await session.execute(delete(ShipmentHistory).where(ShipmentHistory.shipment_id == shipment.id))
                shipment.status_terakhir = None
                shipment.status_terakhir_at = None
                shipment.picked_at = None
                shipment.delivered_at = None
                shipment.progress_terakhir = 0.0
            shipment.biteship_order_id = order.id
            courier_info = order.courier
            remote = Remote(
                order=order,
                history=(courier_info.history if courier_info else None) or [],
                status=order.status or "confirmed",
                tracking_id=courier_info.tracking_id if courier_info else None,
            )
            await apply_remote(session, shipment, remote, now, deps.settings.TIMEZONE)
            # Riwayat lengkap diambil saat halaman dibuka / webhook pertama datang.
            shipment.last_synced_at = None
            await session.commit()

            mode = "SANDBOX (simulasi)" if deps.biteship.is_sandbox else "PRODUCTION"
            typer.echo(f"Order dibuat di Biteship [{mode}]")
            typer.echo(f"  order_id    : {shipment.biteship_order_id}")
            typer.echo(f"  tracking_id : {shipment.biteship_tracking_id}")
            typer.echo(f"  waybill_id  : {shipment.waybill_id}")
            typer.echo(f"  status      : {shipment.status_terakhir}")
            typer.echo(f"Buka {deps.settings.APP_BASE_URL.rstrip('/')}/tracking/{shipment.no_resi}")

    run(job)


@cli.command()
def sync(no_resi: Annotated[str, typer.Argument(help="No. resi pengiriman.")]) -> None:
    """Sinkron manual satu pengiriman dari Biteship."""

    async def job() -> None:
        async with runtime() as (session, deps):
            shipment = await get_shipment(session, no_resi)
            if shipment is None:
                typer.echo(f"No. resi {no_resi} tidak ditemukan.", err=True)
                raise typer.Exit(1)
            if not (shipment.biteship_order_id or shipment.biteship_tracking_id):
                typer.echo("Pengiriman ini belum punya order Biteship (jalankan create-test-order dulu).", err=True)
                raise typer.Exit(1)
            try:
                await sync_shipment(session, shipment, deps.biteship, utcnow(), deps.settings.TIMEZONE)
            except BiteshipError as error:
                typer.echo(f"Sinkron gagal: {error.message} (HTTP {error.status})", err=True)
                raise typer.Exit(1) from error
            typer.echo(f"{shipment.no_resi}: status {shipment.status_terakhir}, {len(shipment.histories)} history, waybill {shipment.waybill_id or '-'}")

    run(job)


@cli.command("setup-storage")
def setup_storage() -> None:
    """Buat bucket privat Supabase Storage untuk foto bukti (aman dijalankan berulang)."""

    async def job() -> None:
        async with httpx.AsyncClient() as http:
            deps = build_deps(get_settings(), http)
            if not deps.storage.enabled:
                typer.echo("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi.", err=True)
                raise typer.Exit(1)
            created = await deps.storage.ensure_bucket()
            bucket = deps.settings.SUPABASE_STORAGE_BUCKET
            typer.echo(f"Bucket privat '{bucket}' dibuat." if created else f"Bucket '{bucket}' sudah ada.")

    run(job)


if __name__ == "__main__":
    cli()
