"""Model SQLAlchemy. Skema sebenarnya dibuat oleh Alembic (alembic/versions), bukan dari sini.

Semua kolom waktu bertipe timestamptz dan disimpan dalam UTC.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

TZDateTime = DateTime(timezone=True)


class Shipment(Base):
    __tablename__ = "shipments"
    # Nilai buatan server (updated_at) diambil lewat RETURNING saat flush. Tanpa ini atributnya
    # kedaluwarsa setelah UPDATE dan membacanya memicu lazy load, yang dilarang di mode async.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    no_resi: Mapped[str] = mapped_column(String(40), unique=True, index=True)

    biteship_order_id: Mapped[str | None] = mapped_column(String(80), index=True)
    biteship_tracking_id: Mapped[str | None] = mapped_column(String(80))
    waybill_id: Mapped[str | None] = mapped_column(String(80))
    courier_company: Mapped[str | None] = mapped_column(String(60))
    courier_service: Mapped[str | None] = mapped_column(String(60))
    # Data driver dari Biteship (kurir reguler biasanya kosong). Tabel `drivers` menimpanya.
    kurir_driver_nama: Mapped[str | None] = mapped_column(String(120))
    kurir_driver_telepon: Mapped[str | None] = mapped_column(String(40))
    kurir_driver_no_polisi: Mapped[str | None] = mapped_column(String(20))

    via: Mapped[str | None] = mapped_column(String(10))  # darat / laut / udara
    layanan: Mapped[str | None] = mapped_column(String(60))
    layanan_keterangan: Mapped[str | None] = mapped_column(String(120))

    pengirim_nama: Mapped[str | None] = mapped_column(String(120))
    alamat_muat: Mapped[str | None] = mapped_column(Text)
    muat_lat: Mapped[float | None] = mapped_column(Float)
    muat_lng: Mapped[float | None] = mapped_column(Float)
    penerima_nama: Mapped[str | None] = mapped_column(String(120))
    alamat_bongkar: Mapped[str | None] = mapped_column(Text)
    bongkar_lat: Mapped[float | None] = mapped_column(Float)
    bongkar_lng: Mapped[float | None] = mapped_column(Float)

    koli: Mapped[int | None] = mapped_column(Integer)
    ikat: Mapped[int | None] = mapped_column(Integer)
    qty: Mapped[int | None] = mapped_column(Integer)
    berat_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    tanggal_muat: Mapped[date | None] = mapped_column(Date)
    estimasi_tiba: Mapped[date | None] = mapped_column(Date)
    lead_time_hari: Mapped[int | None] = mapped_column(Integer)

    jarak_km: Mapped[Decimal | None] = mapped_column(Numeric(8, 1))  # dari OSRM
    # Cache polyline OSRM sebagai daftar [lat, lng] (urutan Leaflet, bukan GeoJSON).
    route_geometry: Mapped[list[Any] | None] = mapped_column(JSONB)

    status_terakhir: Mapped[str | None] = mapped_column(String(40))
    status_terakhir_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    # Progress (0-1) saat status terakhir berganti; dipakai on_hold, retur dan status tak dikenal.
    progress_terakhir: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    picked_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    delivered_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    last_synced_at: Mapped[datetime | None] = mapped_column(TZDateTime)

    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now())

    histories: Mapped[list["ShipmentHistory"]] = relationship(back_populates="shipment", lazy="selectin", cascade="all, delete-orphan")
    driver: Mapped["Driver | None"] = relationship(back_populates="shipment", lazy="selectin", uselist=False, cascade="all, delete-orphan")


class ShipmentHistory(Base):
    __tablename__ = "shipment_histories"
    # Webhook yang terkirim ganda membawa status dan waktu yang sama: ON CONFLICT DO NOTHING.
    __table_args__ = (UniqueConstraint("shipment_id", "status", "occurred_at", name="uq_shipment_histories_event"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    tahap: Mapped[str] = mapped_column(Text)
    posisi: Mapped[str | None] = mapped_column(String(160))
    memo: Mapped[str | None] = mapped_column(Text)
    # Path objek di Supabase Storage, BUKAN URL. Signed URL dibuat saat halaman dirender.
    foto_path: Mapped[str | None] = mapped_column(String(300))
    occurred_at: Mapped[datetime] = mapped_column(TZDateTime)
    source: Mapped[str] = mapped_column(String(10))  # 'biteship' / 'manual'
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now())

    shipment: Mapped[Shipment] = relationship(back_populates="histories")


class Driver(Base):
    """Override data kurir untuk satu pengiriman (kurir reguler tidak memberi data driver)."""

    __tablename__ = "drivers"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"), unique=True)
    nama: Mapped[str | None] = mapped_column(String(120))
    telepon: Mapped[str | None] = mapped_column(String(40))
    kendaraan: Mapped[str | None] = mapped_column(String(80))
    no_polisi: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now())

    shipment: Mapped[Shipment] = relationship(back_populates="driver")
