"""Tabel awal: shipments, shipment_histories, drivers (+ Row Level Security)

Revision ID: 0001
Revises:
Create Date: 2026-11-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TZ = sa.DateTime(timezone=True)
# alembic_version dibuat Alembic sebelum migration pertama berjalan; ia juga berada di schema
# public, jadi ikut ditutup.
TABLES = ("shipments", "shipment_histories", "drivers", "alembic_version")


def upgrade() -> None:
    op.create_table(
        "shipments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("no_resi", sa.String(40), nullable=False),
        sa.Column("biteship_order_id", sa.String(80)),
        sa.Column("biteship_tracking_id", sa.String(80)),
        sa.Column("waybill_id", sa.String(80)),
        sa.Column("courier_company", sa.String(60)),
        sa.Column("courier_service", sa.String(60)),
        sa.Column("kurir_driver_nama", sa.String(120)),
        sa.Column("kurir_driver_telepon", sa.String(40)),
        sa.Column("kurir_driver_no_polisi", sa.String(20)),
        sa.Column("via", sa.String(10)),
        sa.Column("layanan", sa.String(60)),
        sa.Column("layanan_keterangan", sa.String(120)),
        sa.Column("pengirim_nama", sa.String(120)),
        sa.Column("alamat_muat", sa.Text()),
        sa.Column("muat_lat", sa.Float()),
        sa.Column("muat_lng", sa.Float()),
        sa.Column("penerima_nama", sa.String(120)),
        sa.Column("alamat_bongkar", sa.Text()),
        sa.Column("bongkar_lat", sa.Float()),
        sa.Column("bongkar_lng", sa.Float()),
        sa.Column("koli", sa.Integer()),
        sa.Column("ikat", sa.Integer()),
        sa.Column("qty", sa.Integer()),
        sa.Column("berat_kg", sa.Numeric(12, 2)),
        sa.Column("tanggal_muat", sa.Date()),
        sa.Column("estimasi_tiba", sa.Date()),
        sa.Column("lead_time_hari", sa.Integer()),
        sa.Column("jarak_km", sa.Numeric(8, 1)),
        sa.Column("route_geometry", postgresql.JSONB()),
        sa.Column("status_terakhir", sa.String(40)),
        sa.Column("status_terakhir_at", TZ),
        sa.Column("progress_terakhir", sa.Float(), nullable=False, server_default="0"),
        sa.Column("picked_at", TZ),
        sa.Column("delivered_at", TZ),
        sa.Column("last_synced_at", TZ),
        sa.Column("created_at", TZ, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TZ, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_shipments_no_resi", "shipments", ["no_resi"], unique=True)
    op.create_index("ix_shipments_biteship_order_id", "shipments", ["biteship_order_id"])

    op.create_table(
        "shipment_histories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shipment_id", sa.Integer(), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("tahap", sa.Text(), nullable=False),
        sa.Column("posisi", sa.String(160)),
        sa.Column("memo", sa.Text()),
        sa.Column("foto_path", sa.String(300)),
        sa.Column("occurred_at", TZ, nullable=False),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", TZ, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("shipment_id", "status", "occurred_at", name="uq_shipment_histories_event"),
        sa.CheckConstraint("source IN ('biteship', 'manual')", name="ck_shipment_histories_source"),
    )
    op.create_index("ix_shipment_histories_shipment_id", "shipment_histories", ["shipment_id"])

    op.create_table(
        "drivers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shipment_id", sa.Integer(), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("nama", sa.String(120)),
        sa.Column("telepon", sa.String(40)),
        sa.Column("kendaraan", sa.String(80)),
        sa.Column("no_polisi", sa.String(20)),
        sa.Column("created_at", TZ, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TZ, nullable=False, server_default=sa.func.now()),
    )

    # Keamanan Supabase: tabel di schema public terbuka lewat Data API bagi pemegang anon key,
    # kecuali RLS menyala. RLS dinyalakan TANPA policy apa pun: akses lewat Data API tertutup
    # total, sedangkan FastAPI tetap bisa membaca dan menulis karena terhubung sebagai role
    # `postgres` (pemilik tabel), yang tidak dibatasi RLS.
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("drivers")
    op.drop_index("ix_shipment_histories_shipment_id", table_name="shipment_histories")
    op.drop_table("shipment_histories")
    op.drop_index("ix_shipments_biteship_order_id", table_name="shipments")
    op.drop_index("ix_shipments_no_resi", table_name="shipments")
    op.drop_table("shipments")
