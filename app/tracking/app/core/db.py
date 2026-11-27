"""Koneksi async ke PostgreSQL Supabase lewat Transaction pooler (Supavisor, port 6543).

Transaction pooler tidak mendukung prepared statements, sehingga cache statement asyncpg dan
SQLAlchemy dimatikan dan setiap prepared statement diberi nama unik. Pooling ditangani
Supavisor, jadi di sisi aplikasi dipakai NullPool.
"""
from collections.abc import AsyncIterator
from uuid import uuid4

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from .config import Settings


class Base(DeclarativeBase):
    pass


def create_engine(settings: Settings) -> AsyncEngine:
    url = settings.DATABASE_URL.get_secret_value()
    if not url:
        raise RuntimeError("DATABASE_URL belum diisi (lihat .env.example).")
    return create_async_engine(
        url,
        poolclass=NullPool,  # pooling sudah ditangani Supavisor
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
            "ssl": settings.DATABASE_SSL,
        },
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    # expire_on_commit=False: objek tetap bisa dibaca setelah commit tanpa query ulang
    # (lazy load tersembunyi tidak diizinkan di mode async).
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Dependency FastAPI: satu session per request. Commit dilakukan eksplisit oleh service."""
    async with request.app.state.sessionmaker() as session:
        yield session
