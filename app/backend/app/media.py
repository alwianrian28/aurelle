"""Photos uploaded from the dashboard (product photos, collection banners).

The bytes live in Postgres, so the API needs no disk or bucket of its own. Every upload gets a
random name that never changes, which lets browsers and the CDN cache it for a year.
"""
import re
import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool

from .auth import Admin, Db, now_iso

router = APIRouter(prefix="/api/media", tags=["media"])
admin = APIRouter(prefix="/api/admin/media", tags=["admin"])

# Vercel refuses request bodies over 4.5 MB; the dashboard shrinks photos well below this first.
MAX_BYTES = 4 * 1024 * 1024
NAME = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")


def _kind(data: bytes) -> tuple[str, str] | None:
    """File type from the bytes themselves; the Content-Type header is the sender's claim only.
    Raster photos only: SVG can carry scripts, so it is not accepted."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


@admin.post("", status_code=201)
async def upload(request: Request, user: Admin, db: Db):
    """Body: the image bytes (JPEG, PNG or WebP). Answers with the address to store as a photo."""
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BYTES:
        raise HTTPException(413, "too_large")
    data = await request.body()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "too_large")
    kind = _kind(data)
    if not kind:
        raise HTTPException(400, "not_an_image")
    name = f"{uuid.uuid4().hex}.{kind[0]}"
    # Off the event loop: sending megabytes to a distant database must not stall other requests.
    await run_in_threadpool(
        db.execute,
        "INSERT INTO media_files (id, content_type, data, size, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, kind[1], data, len(data), f"admin:{user['id']}", now_iso()),
    )
    return {"src": f"/api/media/{name}", "size": len(data)}


@router.get("/{name}")
def serve(name: str, db: Db):
    row = db.execute("SELECT content_type, data FROM media_files WHERE id = ?", (name,)).fetchone() if NAME.match(name) else None
    if not row:
        raise HTTPException(404, "not_found")
    # The name is random and the bytes behind it never change.
    headers = {"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"}
    return Response(content=bytes(row["data"]), media_type=row["content_type"], headers=headers)
