"""Posisi ESTIMASI kendaraan di sepanjang rute. Fungsi murni: tanpa I/O, tanpa jam sistem.

Kurir reguler tidak mengirim koordinat, jadi posisi dihitung dari status + waktu:
progress 0 = titik muat, 1 = titik bongkar. Rute adalah daftar titik (lat, lng).
"""
from collections.abc import Sequence
from datetime import datetime
from math import asin, cos, radians, sin, sqrt

from .status import Kind, status_info

PICKED_PROGRESS = 0.05
# Selama status belum benar-benar `delivered`, kendaraan tidak digambar sampai di tujuan.
MAX_TRANSIT_PROGRESS = 0.95
EARTH_RADIUS_KM = 6371.0088

Point = tuple[float, float]


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def haversine_km(a: Sequence[float], b: Sequence[float]) -> float:
    lat1, lng1, lat2, lng2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


def estimate_progress(
    status: str | None,
    picked_at: datetime | None,
    estimasi_tiba: datetime | None,
    now: datetime,
    last_progress: float | None,
) -> float:
    """Progress 0-1 diukur dari titik muat.

    `last_progress` adalah progress saat status terakhir berganti; dipakai oleh status yang
    tidak punya posisi sendiri (on_hold, gagal, tak dikenal) dan sebagai titik balik retur.
    """
    kind = status_info(status).kind
    last = clamp(last_progress or 0.0)
    if kind is Kind.PRE_PICKUP:
        return 0.0
    if kind is Kind.PICKED:
        return PICKED_PROGRESS
    if kind is Kind.TRANSIT:
        if picked_at is None or estimasi_tiba is None:
            return clamp(last, PICKED_PROGRESS, MAX_TRANSIT_PROGRESS)
        total = (estimasi_tiba - picked_at).total_seconds()
        elapsed = (now - picked_at).total_seconds()
        fraction = 1.0 if total <= 0 else clamp(elapsed / total)
        return min(PICKED_PROGRESS + 0.9 * fraction, MAX_TRANSIT_PROGRESS)
    if kind is Kind.DELIVERED:
        return 1.0
    if kind is Kind.RETURNING:
        # Arah dibalik tanpa data waktu: diperkirakan di tengah jalan pulang.
        return last / 2
    if kind is Kind.RETURNED:
        return 0.0
    return last  # HOLD, FAILED, UNKNOWN


def point_along_route(coords: Sequence[Sequence[float]], progress: float) -> tuple[float, float, int]:
    """Titik pada `progress` (0-1) dari panjang rute, dihitung dari jarak kumulatif haversine.

    Mengembalikan (lat, lng, split_index): titik berada di segmen
    coords[split_index] -> coords[split_index + 1], hasil interpolasi linear di dalam segmen.
    """
    if not coords:
        raise ValueError("rute kosong")
    if len(coords) == 1:
        return float(coords[0][0]), float(coords[0][1]), 0
    lengths = [haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1)]
    total = sum(lengths)
    last_segment = len(lengths) - 1
    if total == 0:
        return float(coords[0][0]), float(coords[0][1]), 0
    target = clamp(progress) * total
    travelled = 0.0
    for index, length in enumerate(lengths):
        if travelled + length >= target or index == last_segment:
            t = 0.0 if length == 0 else clamp((target - travelled) / length)
            a, b = coords[index], coords[index + 1]
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, index
        travelled += length
    raise AssertionError("tidak terjangkau")  # pragma: no cover


def split_route(coords: Sequence[Sequence[float]], progress: float) -> tuple[list[list[float]], list[list[float]], Point]:
    """Potong rute di posisi kendaraan: (sudah dilewati, sisa perjalanan, posisi)."""
    lat, lng, index = point_along_route(coords, progress)
    point = [lat, lng]
    passed = [list(map(float, c[:2])) for c in coords[: index + 1]] + [point]
    remaining = [point] + [list(map(float, c[:2])) for c in coords[index + 1 :]]
    return passed, remaining, (lat, lng)


def route_length_km(coords: Sequence[Sequence[float]]) -> float:
    return sum(haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
