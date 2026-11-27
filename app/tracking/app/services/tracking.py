"""Orkestrasi halaman tracking: baca DB, sinkron dari Biteship bila perlu, gabungkan dengan
rute OSRM dan foto, lalu susun TrackingResponse.

Aturan sinkron: semua panggilan jaringan dilakukan LEBIH DULU, baru hasilnya ditulis ke DB.
Bila Biteship gagal dihubungi tidak ada yang berubah, dan halaman menampilkan data DB terakhir
dengan peringatan kecil.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.domain import formatting as fmt
from app.domain.position import estimate_progress, split_route
from app.domain.status import Kind, StatusInfo, normalize_status, status_info
from app.models import Shipment, ShipmentHistory
from app.schemas.biteship import HistoryItem, OrderResponse, WebhookPayload
from app.schemas.tracking import DetailOut, DriverOut, HistoryOut, MapOut, SummaryOut, SyncOut, TrackingResponse
from app.services.biteship import BiteshipClient, BiteshipError
from app.services.osrm import OsrmClient, OsrmError
from app.services.storage import StorageService

log = logging.getLogger(__name__)

WARNING_BITESHIP = "Gagal memperbarui dari Biteship. Menampilkan data terakhir yang tersimpan."
WARNING_OSRM = "Rute jalan belum tersedia. Peta menampilkan garis lurus antara titik muat dan bongkar."
POSISI_DEFAULT = {Kind.PICKED: "Lokasi muat", Kind.TRANSIT: "Dalam perjalanan", Kind.DELIVERED: "Lokasi bongkar", Kind.RETURNING: "Dalam perjalanan kembali", Kind.RETURNED: "Lokasi muat"}


@dataclass
class Deps:
    """Klien yang dibuat sekali di lifespan dan dibagikan ke semua request."""

    settings: Settings
    biteship: BiteshipClient
    osrm: OsrmClient
    storage: StorageService


@dataclass
class Remote:
    """Jawaban Biteship untuk satu pengiriman, sudah lengkap sebelum DB disentuh."""

    order: OrderResponse | None
    history: list[HistoryItem]
    status: str
    tracking_id: str | None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_resi(no_resi: str) -> str:
    """No. resi disimpan huruf besar tanpa spasi di tepi."""
    return no_resi.strip().upper()


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


async def get_shipment(session: AsyncSession, no_resi: str) -> Shipment | None:
    return (await session.execute(select(Shipment).where(Shipment.no_resi == normalize_resi(no_resi)))).scalar_one_or_none()


# ----------------------------------------------------------------- status


def current_progress(shipment: Shipment, now: datetime, tz: str) -> float:
    eta = fmt.akhir_hari(shipment.estimasi_tiba, tz) if shipment.estimasi_tiba else None
    return estimate_progress(shipment.status_terakhir, shipment.picked_at, eta, now, shipment.progress_terakhir)


def apply_status(shipment: Shipment, status: str | None, at: datetime, now: datetime, tz: str) -> bool:
    """Ganti status terakhir. Progress saat pergantian disimpan dulu, supaya on_hold, retur dan
    status tak dikenal bisa melanjutkan dari posisi terakhir. Aman dipanggil berulang."""
    status = normalize_status(status)
    if not status or status == shipment.status_terakhir:
        return False
    shipment.progress_terakhir = current_progress(shipment, now, tz)
    shipment.status_terakhir = status
    shipment.status_terakhir_at = at
    kind = status_info(status).kind
    if kind in (Kind.PICKED, Kind.TRANSIT, Kind.DELIVERED) and shipment.picked_at is None:
        shipment.picked_at = at
    if kind is Kind.DELIVERED and shipment.delivered_at is None:
        shipment.delivered_at = at
    return True


async def insert_history(
    session: AsyncSession,
    shipment_id: int,
    status: str,
    occurred_at: datetime,
    source: str,
    memo: str | None = None,
    posisi: str | None = None,
    foto_path: str | None = None,
) -> bool:
    """INSERT ... ON CONFLICT DO NOTHING pada (shipment_id, status, occurred_at). True bila baris baru."""
    status = normalize_status(status)
    statement = (
        pg_insert(ShipmentHistory)
        .values(
            shipment_id=shipment_id,
            status=status,
            tahap=status_info(status).tahap,
            posisi=posisi or None,
            memo=memo or None,
            foto_path=foto_path,
            occurred_at=occurred_at,
            source=source,
        )
        .on_conflict_do_nothing(constraint="uq_shipment_histories_event")
        .returning(ShipmentHistory.id)
    )
    return (await session.execute(statement)).scalar_one_or_none() is not None


def _times_from_histories(shipment: Shipment) -> None:
    """picked_at / delivered_at mengikuti waktu kejadian di riwayat, bukan waktu kita mengetahuinya."""
    moved = [h.occurred_at for h in shipment.histories if status_info(h.status).kind is Kind.PICKED]
    moved = moved or [h.occurred_at for h in shipment.histories if status_info(h.status).kind is Kind.TRANSIT]
    if moved:
        shipment.picked_at = min(moved)
    delivered = [h.occurred_at for h in shipment.histories if status_info(h.status).kind is Kind.DELIVERED]
    if delivered:
        shipment.delivered_at = min(delivered)


# ------------------------------------------------------------------- sync


def has_remote(shipment: Shipment) -> bool:
    return bool(shipment.biteship_order_id or shipment.biteship_tracking_id)


def needs_sync(shipment: Shipment, now: datetime, settings: Settings, force: bool = False) -> bool:
    if not has_remote(shipment):
        return False
    if shipment.last_synced_at is None:
        return True
    age = now - shipment.last_synced_at
    if force:
        return age >= timedelta(seconds=settings.FORCE_SYNC_COOLDOWN_SECONDS)
    return age >= timedelta(minutes=settings.SYNC_INTERVAL_MINUTES)


async def fetch_remote(biteship: BiteshipClient, shipment: Shipment, tracking_id_hint: str | None = None) -> Remote:
    """Ambil order dan riwayatnya dari Biteship. Melempar BiteshipError; DB belum disentuh."""
    order = await biteship.get_order(shipment.biteship_order_id) if shipment.biteship_order_id else None
    courier = order.courier if order else None
    tracking_id = (courier.tracking_id if courier else None) or tracking_id_hint or shipment.biteship_tracking_id
    history: list[HistoryItem] = []
    status = order.status if order else None
    if tracking_id:
        try:
            tracking = await biteship.get_tracking(tracking_id)
            history = tracking.history or []
            status = status or tracking.status
        except BiteshipError:
            if order is None:
                raise
            # Riwayat juga ada di order (courier.history); cukup untuk melanjutkan.
            log.warning("biteship_tracking_fallback", extra={"no_resi": shipment.no_resi})
            history = (courier.history if courier else None) or []
    elif courier and courier.history:
        history = courier.history
    return Remote(order=order, history=history, status=normalize_status(status), tracking_id=tracking_id)


async def apply_remote(session: AsyncSession, shipment: Shipment, remote: Remote, now: datetime, tz: str) -> None:
    """Tulis jawaban Biteship ke DB. Aman diulang dengan jawaban yang sama."""
    courier = remote.order.courier if remote.order else None
    if courier:
        shipment.waybill_id = courier.waybill_id or shipment.waybill_id
        shipment.courier_company = courier.company or shipment.courier_company
        shipment.courier_service = courier.type or shipment.courier_service
        shipment.kurir_driver_nama = courier.driver_name or shipment.kurir_driver_nama
        shipment.kurir_driver_telepon = courier.driver_phone or shipment.kurir_driver_telepon
        shipment.kurir_driver_no_polisi = courier.driver_plate_number or shipment.kurir_driver_no_polisi
    shipment.biteship_tracking_id = remote.tracking_id or shipment.biteship_tracking_id

    for item in remote.history:
        occurred_at = parse_time(item.updated_at)
        if item.status and occurred_at:
            await insert_history(session, shipment.id, item.status, occurred_at, "biteship", memo=(item.note or "")[:1000] or None)
    await session.flush()
    await session.refresh(shipment, attribute_names=["histories"])

    if remote.status:
        same = [h.occurred_at for h in shipment.histories if h.status == remote.status]
        apply_status(shipment, remote.status, max(same) if same else now, now, tz)
    _times_from_histories(shipment)
    shipment.last_synced_at = now


async def sync_shipment(session: AsyncSession, shipment: Shipment, biteship: BiteshipClient, now: datetime, tz: str) -> None:
    """Sinkron satu pengiriman dari Biteship dan commit. Melempar BiteshipError bila gagal."""
    remote = await fetch_remote(biteship, shipment)
    await apply_remote(session, shipment, remote, now, tz)
    await session.commit()
    log.info("shipment_synced", extra={"no_resi": shipment.no_resi, "status": shipment.status_terakhir})


async def ensure_route(session: AsyncSession, shipment: Shipment, osrm: OsrmClient) -> bool:
    """Isi cache rute bila belum ada. True bila rute tersedia setelahnya. Melempar OsrmError."""
    if shipment.route_geometry:
        return True
    if None in (shipment.muat_lat, shipment.muat_lng, shipment.bongkar_lat, shipment.bongkar_lng):
        return False
    route = await osrm.route((shipment.muat_lat, shipment.muat_lng), (shipment.bongkar_lat, shipment.bongkar_lng))
    shipment.route_geometry = route.coords
    shipment.jarak_km = Decimal(str(round(route.distance_km, 1)))
    await session.commit()
    return True


# ---------------------------------------------------------------- webhook


def _apply_payload(shipment: Shipment, payload: WebhookPayload, now: datetime, tz: str) -> None:
    """Biteship tidak bisa ditanya balik: pakai isi webhook, dan tandai agar disinkronkan
    saat halaman dibuka berikutnya (riwayat lengkap datang dari sinkron itu)."""
    shipment.waybill_id = payload.courier_waybill_id or shipment.waybill_id
    shipment.biteship_tracking_id = payload.courier_tracking_id or shipment.biteship_tracking_id
    shipment.kurir_driver_nama = payload.courier_driver_name or shipment.kurir_driver_nama
    shipment.kurir_driver_telepon = payload.courier_driver_phone or shipment.kurir_driver_telepon
    shipment.kurir_driver_no_polisi = payload.courier_driver_plate_number or shipment.kurir_driver_no_polisi
    apply_status(shipment, payload.status, now, now, tz)
    shipment.last_synced_at = None


async def process_webhook(sessionmaker: async_sessionmaker[AsyncSession], deps: Deps, payload: WebhookPayload) -> str:
    """Dijalankan di BackgroundTasks setelah webhook dijawab 200. Tidak pernah melempar.

    Webhook diperlakukan sebagai pemberitahuan "order ini berubah": status, waybill dan riwayat
    dibaca ulang dari Biteship dengan API key kita, sehingga webhook palsu tidak bisa mengisi
    data karangan dan pengiriman ganda menghasilkan baris yang sama (ON CONFLICT DO NOTHING).
    """
    now, tz = utcnow(), deps.settings.TIMEZONE
    try:
        async with sessionmaker() as session:
            shipment = (await session.execute(select(Shipment).where(Shipment.biteship_order_id == payload.order_id))).scalar_one_or_none()
            if shipment is None:
                log.info("webhook_unknown_order", extra={"order_id": payload.order_id})
                return "unknown_order"
            try:
                remote = await fetch_remote(deps.biteship, shipment, tracking_id_hint=payload.courier_tracking_id)
            except BiteshipError:
                _apply_payload(shipment, payload, now, tz)
                outcome = "applied_from_payload"
            else:
                await apply_remote(session, shipment, remote, now, tz)
                outcome = "synced"
            await session.commit()
            log.info("webhook_processed", extra={"no_resi": shipment.no_resi, "status": shipment.status_terakhir, "outcome": outcome})
            return outcome
    except Exception:  # noqa: BLE001 - tugas latar belakang: catat, jangan jatuhkan worker
        log.exception("webhook_failed", extra={"order_id": payload.order_id})
        return "failed"


# ----------------------------------------------------------------- manual


async def add_manual_history(
    session: AsyncSession,
    shipment: Shipment,
    status: str,
    occurred_at: datetime,
    now: datetime,
    tz: str,
    memo: str | None = None,
    posisi: str | None = None,
    foto_path: str | None = None,
) -> bool:
    created = await insert_history(session, shipment.id, status, occurred_at, "manual", memo=memo, posisi=posisi, foto_path=foto_path)
    await session.flush()
    await session.refresh(shipment, attribute_names=["histories"])
    # Catatan manual hanya menggeser status terakhir bila memang kejadian paling baru.
    if created and (shipment.status_terakhir_at is None or occurred_at >= shipment.status_terakhir_at):
        apply_status(shipment, status, occurred_at, now, tz)
        _times_from_histories(shipment)
    await session.commit()
    return created


# --------------------------------------------------------------- response


def _teks(value: object) -> str:
    return str(value) if value not in (None, "") else fmt.KOSONG


def _posisi(history: ShipmentHistory, info: StatusInfo) -> str:
    return history.posisi or POSISI_DEFAULT.get(info.kind, fmt.KOSONG)


def build_map(shipment: Shipment, progress: float, info: StatusInfo) -> MapOut:
    if None in (shipment.muat_lat, shipment.muat_lng, shipment.bongkar_lat, shipment.bongkar_lng):
        return MapOut(available=False)
    origin = [float(shipment.muat_lat), float(shipment.muat_lng)]
    destination = [float(shipment.bongkar_lat), float(shipment.bongkar_lng)]
    coords = shipment.route_geometry or [origin, destination]
    passed, remaining, position = split_route(coords, progress)
    is_return = info.kind in (Kind.RETURNING, Kind.RETURNED)
    if is_return:
        # Arah dibalik: yang sudah ditempuh adalah sisi tujuan, sisanya jalan pulang ke titik muat.
        passed, remaining = remaining, passed
    return MapOut(
        available=True,
        origin=origin,
        destination=destination,
        route_passed=passed,
        route_remaining=remaining,
        vehicle_position=[position[0], position[1]],
        progress=round(progress, 4),
        show_vehicle=info.show_vehicle,
        delivered=info.kind is Kind.DELIVERED,
        is_return=is_return,
        is_straight_line=not shipment.route_geometry,
    )


def build_response(
    shipment: Shipment,
    settings: Settings,
    now: datetime,
    signed_urls: dict[str, str] | None = None,
    synced_now: bool = False,
    warning: str | None = None,
) -> TrackingResponse:
    tz = settings.TIMEZONE
    signed_urls = signed_urls or {}
    info = status_info(shipment.status_terakhir)
    progress = current_progress(shipment, now, tz)
    histories = sorted(shipment.histories, key=lambda h: (h.occurred_at, h.id), reverse=True)

    estimasi = fmt.format_tanggal(shipment.estimasi_tiba)
    if shipment.estimasi_tiba and shipment.lead_time_hari is not None:
        estimasi = f"{estimasi} ({shipment.lead_time_hari} Hari)"

    override = shipment.driver
    nama = (override.nama if override else None) or shipment.kurir_driver_nama
    telepon = (override.telepon if override else None) or shipment.kurir_driver_telepon
    kurir = " ".join(part.upper() for part in (shipment.courier_company, shipment.courier_service) if part)
    updated = max((t for t in (shipment.last_synced_at, shipment.status_terakhir_at, shipment.updated_at) if t), default=None)

    return TrackingResponse(
        no_resi=shipment.no_resi,
        share_url=f"{settings.APP_BASE_URL.rstrip('/')}/tracking/{shipment.no_resi}",
        summary=SummaryOut(
            status=info.status,
            status_label=info.label,
            status_color=info.color,
            status_tahap=info.tahap,
            tanggal_muat=shipment.tanggal_muat,
            tanggal_muat_teks=fmt.format_tanggal(shipment.tanggal_muat),
            estimasi_tiba=shipment.estimasi_tiba,
            lead_time_hari=shipment.lead_time_hari,
            estimasi_tiba_teks=estimasi,
            jarak_km=float(shipment.jarak_km) if shipment.jarak_km is not None else None,
            jarak_teks=fmt.format_jarak(shipment.jarak_km),
            layanan=_teks(shipment.layanan),
            layanan_keterangan=_teks(shipment.layanan_keterangan),
        ),
        detail=DetailOut(
            no_resi=shipment.no_resi,
            via=_teks((shipment.via or "").capitalize()),
            alamat_muat=_teks(shipment.alamat_muat),
            pengirim=_teks(shipment.pengirim_nama),
            alamat_bongkar=_teks(shipment.alamat_bongkar),
            penerima=_teks(shipment.penerima_nama),
            koli=shipment.koli,
            ikat=shipment.ikat,
            qty=shipment.qty,
            berat_kg=float(shipment.berat_kg) if shipment.berat_kg is not None else None,
            berat_teks=fmt.format_berat(shipment.berat_kg),
        ),
        map=build_map(shipment, progress, info),
        driver=DriverOut(
            nama=_teks(nama),
            inisial=fmt.inisial(nama),
            telepon=telepon or None,
            telepon_href=fmt.tautan_telepon(telepon),
            kendaraan=_teks(override.kendaraan if override else None),
            no_polisi=_teks((override.no_polisi if override else None) or shipment.kurir_driver_no_polisi),
            lokasi=_posisi(histories[0], status_info(histories[0].status)) if histories else fmt.KOSONG,
            waktu=fmt.format_tanggal_jam(shipment.status_terakhir_at, tz),
            sumber=f"Biteship – {kurir}" if kurir else ("Biteship" if has_remote(shipment) else "Input manual"),
        ),
        histories=[
            HistoryOut(
                status=h.status,
                label=(hi := status_info(h.status)).label,
                color=hi.color,
                tahap=h.tahap or hi.tahap,
                posisi=_posisi(h, hi),
                memo=h.memo or None,
                foto_url=signed_urls.get(h.foto_path) if h.foto_path else None,
                occurred_at=h.occurred_at,
                tanggal=fmt.format_tanggal(h.occurred_at, tz),
                jam=f"{fmt.format_jam(h.occurred_at, tz)} {fmt.label_zona(tz)}",
                source=h.source,
            )
            for h in histories
        ],
        sync=SyncOut(
            last_synced_at=shipment.last_synced_at,
            last_update_teks=fmt.format_tanggal_jam(updated, tz),
            is_sandbox=settings.is_sandbox,
            synced_now=synced_now,
            warning=warning,
        ),
    )


async def get_tracking_view(session: AsyncSession, deps: Deps, no_resi: str, force: bool = False, now: datetime | None = None) -> TrackingResponse | None:
    """Data lengkap satu halaman tracking, atau None bila resi tidak ada."""
    now = now or utcnow()
    shipment = await get_shipment(session, no_resi)
    if shipment is None:
        return None
    warnings: list[str] = []
    synced_now = False
    if needs_sync(shipment, now, deps.settings, force):
        try:
            await sync_shipment(session, shipment, deps.biteship, now, deps.settings.TIMEZONE)
            synced_now = True
        except BiteshipError as error:
            log.warning("sync_failed", extra={"no_resi": shipment.no_resi, "status": error.status})
            warnings.append(WARNING_BITESHIP)
    try:
        await ensure_route(session, shipment, deps.osrm)
    except OsrmError:
        warnings.append(WARNING_OSRM)
    signed_urls = await deps.storage.signed_urls([h.foto_path for h in shipment.histories if h.foto_path])
    return build_response(shipment, deps.settings, now, signed_urls, synced_now, " ".join(warnings) or None)
