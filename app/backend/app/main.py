"""Aurelle API: one FastAPI service for the public site, the admin desk and the mobile app."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, catalog, media, orders, payments
from .config import app_origins, is_prod, media_dir
from .db import close_pool, init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield
    close_pool()


def create_app() -> FastAPI:
    # Interactive docs are a development aid; not exposed in production.
    app = FastAPI(title="Aurelle API", lifespan=lifespan, docs_url=None if is_prod() else "/api/docs", redoc_url=None, openapi_url=None if is_prod() else "/api/openapi.json")

    @app.middleware("http")
    async def same_origin_writes(request: Request, call_next):
        # CSRF: the session cookie is SameSite=Lax; on top of that, state-changing requests
        # must come from our own origin. Requests without an Origin header (native apps,
        # server-to-server) carry no browser cookies set by another site, so they pass.
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            own = f"{request.url.scheme}://{request.headers.get('host', '')}"
            if origin and origin not in (*app_origins(), own):
                return JSONResponse({"error": "bad_origin"}, status_code=403)
        return await call_next(request)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        body = exc.detail if isinstance(exc.detail, dict) else {"error": exc.detail}
        return JSONResponse(body, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, __: RequestValidationError):
        # Field-level details stay out of the response; clients validate before sending.
        return JSONResponse({"error": "invalid_input"}, status_code=400)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(auth.router)
    app.include_router(auth.admin_router)
    app.include_router(catalog.router)
    app.include_router(catalog.admin)
    app.include_router(orders.customer)
    app.include_router(orders.admin)
    app.include_router(payments.router)
    app.include_router(media.router)
    app.include_router(media.admin)
    # Product photos for the mobile app in development. In production they belong on object
    # storage / a CDN (PRD §9), so nothing is mounted there.
    if not is_prod() and os.path.isdir(media_dir()):
        app.mount("/media", StaticFiles(directory=media_dir()), name="media")
    return app


app = create_app()
