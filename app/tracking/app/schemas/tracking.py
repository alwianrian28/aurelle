"""Bentuk data halaman tracking. Dipakai dua kali: sebagai JSON (`GET /api/tracking/{no_resi}`)
dan sebagai konteks template Jinja, supaya keduanya tidak pernah berbeda."""
from datetime import date, datetime

from pydantic import BaseModel


class SummaryOut(BaseModel):
    status: str
    status_label: str
    status_color: str
    status_tahap: str
    tanggal_muat: date | None
    tanggal_muat_teks: str
    estimasi_tiba: date | None
    lead_time_hari: int | None
    estimasi_tiba_teks: str
    jarak_km: float | None
    jarak_teks: str
    layanan: str
    layanan_keterangan: str


class DetailOut(BaseModel):
    no_resi: str
    via: str
    alamat_muat: str
    pengirim: str
    alamat_bongkar: str
    penerima: str
    koli: int | None
    ikat: int | None
    qty: int | None
    berat_kg: float | None
    berat_teks: str


class MapOut(BaseModel):
    """Semua koordinat berbentuk [lat, lng]. Posisi kendaraan adalah ESTIMASI, bukan GPS."""

    available: bool
    origin: list[float] | None = None
    destination: list[float] | None = None
    route_passed: list[list[float]] = []
    route_remaining: list[list[float]] = []
    vehicle_position: list[float] | None = None
    progress: float = 0.0
    show_vehicle: bool = False
    delivered: bool = False
    is_return: bool = False
    # Rute belum didapat dari OSRM: yang digambar garis lurus antara kedua titik.
    is_straight_line: bool = False
    note: str = "Perkiraan posisi berdasarkan status pengiriman"


class DriverOut(BaseModel):
    nama: str
    inisial: str
    telepon: str | None
    telepon_href: str | None
    kendaraan: str
    no_polisi: str
    lokasi: str
    waktu: str
    sumber: str


class HistoryOut(BaseModel):
    status: str
    label: str
    color: str
    tahap: str
    posisi: str
    memo: str | None
    foto_url: str | None
    occurred_at: datetime
    tanggal: str
    jam: str
    source: str


class SyncOut(BaseModel):
    last_synced_at: datetime | None
    last_update_teks: str
    is_sandbox: bool
    # True bila request ini baru saja mengambil data dari Biteship.
    synced_now: bool
    # Biteship / OSRM tidak bisa dihubungi: data yang tampil adalah data DB terakhir.
    warning: str | None = None


class TrackingResponse(BaseModel):
    no_resi: str
    share_url: str
    summary: SummaryOut
    detail: DetailOut
    map: MapOut
    driver: DriverOut
    histories: list[HistoryOut]
    sync: SyncOut


class ErrorResponse(BaseModel):
    error: str
    message: str
    no_resi: str | None = None
