"""API JSON: data tracking (tombol refresh), input history manual, health check."""
import hmac
import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.schemas.tracking import ErrorResponse, TrackingResponse
from app.services.storage import StorageError
from app.services.tracking import add_manual_history, build_response, get_shipment, get_tracking_view, normalize_resi, parse_time, utcnow

from .deps import DepsDep, SessionDep

log = logging.getLogger(__name__)
router = APIRouter()

MAX_FOTO_BYTES = 5 * 1024 * 1024
# Tipe yang diterima -> (ekstensi, cek tanda tangan isi file). Content-Type dari browser saja
# tidak dipercaya.
FOTO_TYPES = {
    "image/jpeg": ("jpg", lambda b: b[:3] == b"\xff\xd8\xff"),
    "image/png": ("png", lambda b: b[:8] == b"\x89PNG\r\n\x1a\n"),
    "image/webp": ("webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}


def not_found(no_resi: str) -> JSONResponse:
    body = ErrorResponse(error="resi_tidak_ditemukan", message="No. resi tidak ditemukan.", no_resi=normalize_resi(no_resi))
    return JSONResponse(body.model_dump(), status_code=404)


@router.get("/api/tracking/{no_resi}", response_model=TrackingResponse, responses={404: {"model": ErrorResponse}})
async def tracking_json(no_resi: str, session: SessionDep, deps: DepsDep, force: bool = False):
    """Data halaman tracking. `?force=true` meminta sinkron ulang dari Biteship (dibatasi
    satu kali per FORCE_SYNC_COOLDOWN_SECONDS untuk setiap resi)."""
    view = await get_tracking_view(session, deps, no_resi, force=force)
    return view if view else not_found(no_resi)


@router.post("/api/shipments/{no_resi}/histories", response_model=TrackingResponse, status_code=201, responses={404: {"model": ErrorResponse}})
async def add_history(
    no_resi: str,
    session: SessionDep,
    deps: DepsDep,
    status: Annotated[str, Form(min_length=1, max_length=40, pattern=r"^[A-Za-z_]+$")],
    memo: Annotated[str, Form(max_length=1000)] = "",
    posisi: Annotated[str, Form(max_length=160)] = "",
    occurred_at: Annotated[str, Form(max_length=40)] = "",
    foto: Annotated[UploadFile | None, File()] = None,
    x_admin_token: Annotated[str, Header()] = "",
):
    """Input history manual (multipart), dengan foto bukti opsional.

    Halaman tracking bersifat publik, jadi endpoint tulis ini dijaga header `X-Admin-Token`
    (ADMIN_API_TOKEN). Tanpa token di .env, endpoint ini mati.
    """
    token = deps.settings.ADMIN_API_TOKEN.get_secret_value()
    if not token:
        raise HTTPException(503, "Input manual dimatikan (ADMIN_API_TOKEN belum diisi).")
    if not hmac.compare_digest(x_admin_token.encode(), token.encode()):
        raise HTTPException(401, "Token admin salah.")

    shipment = await get_shipment(session, no_resi)
    if shipment is None:
        return not_found(no_resi)
    now = utcnow()
    when = parse_time(occurred_at) if occurred_at.strip() else now
    if when is None:
        raise HTTPException(422, "occurred_at harus berformat ISO 8601, contoh 2026-01-08T14:05:00+07:00.")

    foto_path: str | None = None
    if foto is not None and foto.filename:
        kind = FOTO_TYPES.get((foto.content_type or "").lower())
        if kind is None:
            raise HTTPException(415, "Foto harus berupa JPEG, PNG atau WebP.")
        data = await foto.read(MAX_FOTO_BYTES + 1)
        if len(data) > MAX_FOTO_BYTES:
            raise HTTPException(413, "Ukuran foto maksimal 5 MB.")
        extension, looks_right = kind
        if not looks_right(data):
            raise HTTPException(415, "Isi file tidak sesuai dengan tipe gambar yang dikirim.")
        try:
            foto_path = await deps.storage.upload(f"{shipment.id}/{uuid4().hex}.{extension}", data, foto.content_type.lower())
        except StorageError as error:
            raise HTTPException(503, str(error)) from error

    await add_manual_history(
        session, shipment, status, when.astimezone(timezone.utc), now, deps.settings.TIMEZONE,
        memo=memo.strip() or None, posisi=posisi.strip() or None, foto_path=foto_path,
    )
    log.info("manual_history_added", extra={"no_resi": shipment.no_resi, "status": status, "foto": bool(foto_path)})
    signed = await deps.storage.signed_urls([h.foto_path for h in shipment.histories if h.foto_path])
    return build_response(shipment, deps.settings, now, signed)


@router.get("/healthz")
async def healthz(session: SessionDep):
    """SELECT 1 ke database (Supabase)."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - apa pun sebabnya, jawabannya "database tidak sehat"
        log.exception("healthz_failed")
        return JSONResponse({"status": "error", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "database": "ok", "time": datetime.now(timezone.utc).isoformat(timespec="seconds")}
