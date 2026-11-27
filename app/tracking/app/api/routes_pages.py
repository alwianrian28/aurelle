"""Halaman HTML publik (Jinja2). Tidak ada key atau connection string yang masuk ke template."""
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.services.tracking import get_tracking_view, normalize_resi

from .deps import DepsDep, SessionDep

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=Path(__file__).resolve().parents[1] / "templates")


@router.get("/")
async def home() -> RedirectResponse:
    return RedirectResponse("/tracking", status_code=307)


@router.get("/tracking", response_class=HTMLResponse)
async def tracking_form(request: Request, deps: DepsDep, no_resi: str = ""):
    """Form kosong. `?no_resi=` (form tanpa JavaScript) dialihkan ke halaman resinya."""
    if no_resi.strip():
        return RedirectResponse(request.url_for("tracking_page", no_resi=normalize_resi(no_resi)), status_code=303)
    return templates.TemplateResponse(request, "tracking.html", {"t": None, "no_resi": "", "not_found": False, "is_sandbox": deps.settings.is_sandbox})


@router.get("/tracking/{no_resi}", response_class=HTMLResponse, name="tracking_page")
async def tracking_page(request: Request, no_resi: str, session: SessionDep, deps: DepsDep):
    view = await get_tracking_view(session, deps, no_resi)
    context = {"t": view, "no_resi": normalize_resi(no_resi), "not_found": view is None, "is_sandbox": deps.settings.is_sandbox}
    return templates.TemplateResponse(request, "tracking.html", context, status_code=200 if view else 404)
