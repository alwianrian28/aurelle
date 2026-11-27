"""Halaman Tracking Pengiriman: FastAPI + Supabase (PostgreSQL) + Biteship.

Jalankan: uvicorn app.main:app --reload
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import routes_api, routes_pages, routes_webhook
from app.core.config import Settings, get_settings
from app.core.db import create_engine, create_sessionmaker
from app.core.logging import setup_logging
from app.services.biteship import BiteshipClient
from app.services.osrm import OsrmClient
from app.services.storage import StorageService
from app.services.tracking import Deps

APP_DIR = Path(__file__).resolve().parent


def build_deps(settings: Settings, http: httpx.AsyncClient) -> Deps:
    return Deps(
        settings=settings,
        biteship=BiteshipClient(http, settings.BITESHIP_API_KEY.get_secret_value(), settings.BITESHIP_BASE_URL),
        osrm=OsrmClient(http, settings.OSRM_BASE_URL),
        storage=StorageService(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value(),
            settings.SUPABASE_STORAGE_BUCKET,
            settings.SIGNED_URL_TTL_SECONDS,
        ),
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Satu httpx.AsyncClient dan satu engine untuk seluruh umur aplikasi.
        setup_logging()
        engine = create_engine(settings)
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as http:
            app.state.engine = engine
            app.state.sessionmaker = create_sessionmaker(engine)
            app.state.deps = build_deps(settings, http)
            try:
                yield
            finally:
                await engine.dispose()

    app = FastAPI(title="Tracking Pengiriman", lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
    app.include_router(routes_pages.router)
    app.include_router(routes_api.router)
    app.include_router(routes_webhook.router)
    return app


app = create_app()
