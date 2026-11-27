"""Satu-satunya pemetaan status order Biteship -> tampilan (badge, tahap, perilaku peta).

Daftar status diverifikasi terhadap https://biteship.com/en/docs/api/orders/overview.
Status yang tidak dikenal tidak membuat error: namanya ditampilkan apa adanya dan progress
tetap di posisi terakhir (lihat `status_info`).
"""
import re
from dataclasses import dataclass
from enum import StrEnum


class OrderStatus(StrEnum):
    CONFIRMED = "confirmed"
    SCHEDULED = "scheduled"
    ALLOCATED = "allocated"
    PICKING_UP = "picking_up"
    PICKED = "picked"
    IN_TRANSIT = "in_transit"
    DROPPING_OFF = "dropping_off"
    ON_HOLD = "on_hold"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    COURIER_NOT_FOUND = "courier_not_found"
    RETURN_IN_TRANSIT = "return_in_transit"
    RETURNED = "returned"
    DISPOSED = "disposed"


class Kind(StrEnum):
    """Perilaku progress di peta."""

    PRE_PICKUP = "pre_pickup"  # progress 0
    PICKED = "picked"  # progress 0.05
    TRANSIT = "transit"  # progress dinamis dari waktu
    HOLD = "hold"  # tetap di nilai terakhir
    DELIVERED = "delivered"  # progress 1
    FAILED = "failed"  # marker kendaraan disembunyikan
    RETURNING = "returning"  # arah dibalik, menuju titik muat
    RETURNED = "returned"  # kembali di titik muat
    UNKNOWN = "unknown"  # tetap di nilai terakhir


# Warna badge: hijau = selesai, biru = proses, oranye = retur, merah = gagal, abu = tak dikenal.
GREEN, BLUE, ORANGE, RED, GRAY = "green", "blue", "orange", "red", "gray"


@dataclass(frozen=True)
class StatusInfo:
    status: str
    label: str
    color: str
    tahap: str
    kind: Kind
    show_vehicle: bool = True


def _info(status: OrderStatus, label: str, color: str, tahap: str, kind: Kind, show_vehicle: bool = True) -> StatusInfo:
    return StatusInfo(status.value, label, color, tahap, kind, show_vehicle)


S = OrderStatus
STATUS_MAP: dict[OrderStatus, StatusInfo] = {
    S.CONFIRMED: _info(S.CONFIRMED, "Dikonfirmasi", BLUE, "Order dikonfirmasi", Kind.PRE_PICKUP),
    S.SCHEDULED: _info(S.SCHEDULED, "Dijadwalkan", BLUE, "Order dikonfirmasi", Kind.PRE_PICKUP),
    S.ALLOCATED: _info(S.ALLOCATED, "Kurir Dialokasikan", BLUE, "Order dikonfirmasi", Kind.PRE_PICKUP),
    S.PICKING_UP: _info(S.PICKING_UP, "Penjemputan", BLUE, "Kurir menuju lokasi muat", Kind.PRE_PICKUP),
    S.PICKED: _info(S.PICKED, "Barang Diambil", BLUE, "Tiba di lokasi muat / barang diambil", Kind.PICKED),
    S.IN_TRANSIT: _info(S.IN_TRANSIT, "Dalam Perjalanan", BLUE, "Dalam perjalanan menuju lokasi tujuan", Kind.TRANSIT),
    S.DROPPING_OFF: _info(S.DROPPING_OFF, "Dalam Pengantaran", BLUE, "Dalam perjalanan menuju lokasi tujuan", Kind.TRANSIT),
    S.ON_HOLD: _info(S.ON_HOLD, "Ditahan", BLUE, "Pengiriman ditahan", Kind.HOLD),
    S.DELIVERED: _info(S.DELIVERED, "Terkirim", GREEN, "Barang sudah diterima", Kind.DELIVERED),
    S.CANCELLED: _info(S.CANCELLED, "Dibatalkan", RED, "Pengiriman dibatalkan", Kind.FAILED, show_vehicle=False),
    S.REJECTED: _info(S.REJECTED, "Ditolak", RED, "Pengiriman ditolak", Kind.FAILED, show_vehicle=False),
    S.COURIER_NOT_FOUND: _info(S.COURIER_NOT_FOUND, "Kurir Tidak Ditemukan", RED, "Kurir tidak ditemukan", Kind.FAILED, show_vehicle=False),
    S.RETURN_IN_TRANSIT: _info(S.RETURN_IN_TRANSIT, "Retur Dalam Perjalanan", ORANGE, "Barang dalam perjalanan kembali ke pengirim", Kind.RETURNING),
    S.RETURNED: _info(S.RETURNED, "Diretur", ORANGE, "Barang sudah kembali ke pengirim", Kind.RETURNED),
    S.DISPOSED: _info(S.DISPOSED, "Dimusnahkan", RED, "Barang dimusnahkan", Kind.FAILED, show_vehicle=False),
}


def normalize_status(value: object) -> str:
    """Biteship menulis status sebagai `dropping_off` di satu tempat dan `droppingOff` di tempat lain."""
    return re.sub(r"(?<=[a-z])(?=[A-Z])", "_", str(value or "").strip()).lower()


def status_info(value: object) -> StatusInfo:
    """Info tampilan untuk sebuah status. Status tak dikenal: nama apa adanya, badge abu-abu."""
    status = normalize_status(value)
    try:
        return STATUS_MAP[OrderStatus(status)]
    except ValueError:
        name = status or "–"
        return StatusInfo(status, name, GRAY, name, Kind.UNKNOWN)
