"""Alembic, mode async. Memakai DATABASE_URL_MIGRATION: Session pooler (port 5432) atau
direct connection. Transaction pooler (6543) tidak cocok untuk migration."""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app import models  # noqa: F401 - mendaftarkan semua tabel ke Base.metadata
from app.core.config import get_settings
from app.core.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()


def migration_url() -> str:
    url = settings.DATABASE_URL_MIGRATION.get_secret_value()
    if not url:
        raise RuntimeError("DATABASE_URL_MIGRATION belum diisi (Session pooler port 5432 atau direct connection).")
    return url


def include_name(name: str | None, type_: str, parent_names: dict) -> bool:
    """Database bisa berisi tabel aplikasi lain (mis. proyek Supabase yang dipakai bersama).
    `--autogenerate` hanya boleh melihat tabel milik aplikasi ini, supaya tidak pernah
    mengusulkan DROP untuk tabel orang lain."""
    if type_ == "table":
        return name in target_metadata.tables
    return True


def run_migrations_offline() -> None:
    context.configure(url=migration_url(), target_metadata=target_metadata, literal_binds=True, include_name=include_name)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, include_name=include_name, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(migration_url(), poolclass=NullPool, connect_args={"ssl": settings.DATABASE_SSL})
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
