import os
from pathlib import Path
from urllib.parse import quote

# Local development: pick up the repository's .env (database password or URL) so the backend starts
# with a plain `uvicorn app.main:app`. Variables already set in the environment win.
_env_file = Path(__file__).resolve().parents[3] / ".env"
if _env_file.is_file():
    for _line in _env_file.read_text().splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _key, _value = _line.split("=", 1)
            os.environ.setdefault(_key.strip(), _value.strip())


def is_prod() -> bool:
    return os.environ.get("APP_ENV", "development") == "production"


def app_origins() -> list[str]:
    """Origins allowed to make state-changing requests: the shop first, then the dashboard."""
    raw = os.environ.get("APP_ORIGINS", "http://localhost:5173,http://localhost:5174")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def shop_origin() -> str:
    """Base URL used in links sent to customers (email verification, password reset)."""
    return app_origins()[0]


def google_client_id() -> str | None:
    """OAuth client ID for "Continue with Google" (Google Cloud Console > Credentials > Web
    application). Not a secret. Unset means Google sign-in is switched off."""
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip() or None


def midtrans_server_key() -> str | None:
    """Midtrans server key (Dashboard > Settings > Access Keys). Secret: it never leaves the backend.
    Unset means card/QRIS payments are switched off."""
    return os.environ.get("MIDTRANS_SERVER_KEY", "").strip() or None


def midtrans_client_key() -> str | None:
    """Midtrans client key: public, handed to the shop for the card form and Midtrans' own form.
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is read too: the name Midtrans' guides use, and an easy one
    to end up with in .env. Without either, payments fall back to the development simulator."""
    return (os.environ.get("MIDTRANS_CLIENT_KEY") or os.environ.get("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY") or "").strip() or None


def midtrans_is_production() -> bool:
    """Sandbox unless MIDTRANS_IS_PRODUCTION=true. Sandbox keys start with "SB-"."""
    return os.environ.get("MIDTRANS_IS_PRODUCTION", "").strip().lower() == "true"


def midtrans_own_card_form() -> bool:
    """Whether cards are paid in the shop's own card form (the default) or in Midtrans' form
    (MIDTRANS_CARD_FORM=midtrans)."""
    return os.environ.get("MIDTRANS_CARD_FORM", "own").strip().lower() != "midtrans"


def midtrans_own_qris() -> bool:
    """Whether the QRIS code is drawn by the shop itself (the default) or shown in Midtrans'
    form (MIDTRANS_QRIS_FORM=midtrans)."""
    return os.environ.get("MIDTRANS_QRIS_FORM", "own").strip().lower() != "midtrans"


def midtrans_notification_url() -> str | None:
    """Where Midtrans sends payment notifications for transactions created here. Sent with
    every transaction, so it wins over the URL saved in the Midtrans dashboard: payments started
    from a developer's machine still notify the deployed site. Set it to an empty value to fall
    back to the dashboard setting."""
    return os.environ.get("MIDTRANS_NOTIFICATION_URL", "https://byaurelle.vercel.app/api/payments/midtrans/notification").strip() or None


def biteship_api_key() -> str | None:
    """Biteship API key (Dashboard > Integrations > API key). Secret. `biteship_test.…` books
    simulated shipments, `biteship_live.…` real ones. Unset means courier rates, booking and
    tracking are switched off."""
    return os.environ.get("BITESHIP_API_KEY", "").strip() or None


def biteship_couriers() -> str:
    """Couriers to ask for rates, as Biteship's codes separated by commas."""
    return os.environ.get("BITESHIP_COURIERS", "").replace(" ", "").strip(",") or "jne,jnt,sicepat,anteraja"


def biteship_origin() -> dict | None:
    """Where parcels are collected: the store's contact, address and 5-digit postal code
    (BITESHIP_ORIGIN_NAME, _PHONE, _ADDRESS, _POSTAL_CODE; the postal code is also read from
    ORIGIN_POSTAL_CODE). None until all four are set."""
    origin = {key: os.environ.get(f"BITESHIP_ORIGIN_{env}", "").strip() for key, env in (("name", "NAME"), ("phone", "PHONE"), ("address", "ADDRESS"), ("postalCode", "POSTAL_CODE"))}
    origin["postalCode"] = origin["postalCode"] or os.environ.get("ORIGIN_POSTAL_CODE", "").strip()
    return origin if all(origin.values()) else None


def biteship_auto_book() -> bool:
    """Whether a shipment is booked the moment an order is paid (the default). With
    BITESHIP_AUTO_BOOK=false, staff book from the dashboard when the parcel is ready."""
    return os.environ.get("BITESHIP_AUTO_BOOK", "true").strip().lower() not in ("false", "0", "no", "off")


def biteship_webhook_token() -> str | None:
    """Secret carried in the webhook's address: register the webhook at Biteship as
    …/api/shipping/biteship/webhook?token=<this value>. Unset means the address is not guarded
    by a token."""
    return os.environ.get("BITESHIP_WEBHOOK_TOKEN", "").strip() or None


def biteship_webhook_auth() -> tuple[str, str | None]:
    """(header name, secret) Biteship sends with every webhook: the "signature key" and
    "signature secret" filled in when the webhook is added in its dashboard. The older of the
    two guards; BITESHIP_WEBHOOK_TOKEN is the simpler one. Either is enough."""
    return os.environ.get("BITESHIP_WEBHOOK_HEADER", "x-aurelle-webhook").strip().lower(), os.environ.get("BITESHIP_WEBHOOK_SECRET", "").strip() or None


def biteship_tracking_cache_seconds() -> int:
    """How long Biteship's answer about a shipment is reused before it is asked again
    (BITESHIP_TRACKING_CACHE_SECONDS, default 60). 0 asks every time."""
    return max(0, _number("BITESHIP_TRACKING_CACHE_SECONDS", 60))


def _number(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "").strip() or default)
    except ValueError:
        return default


def _percent_range(name: str, default: tuple[int, int]) -> tuple[float, float]:
    """A range written as "5-85" (percent of the route), as fractions. A value that cannot be
    read, or runs backwards, gives the default."""
    parts = os.environ.get(name, "").replace(" ", "").split("-")
    try:
        low, high = (float(p) for p in parts)
    except ValueError:
        low, high = default
    if not 0 <= low <= high <= 100:
        low, high = default
    return low / 100, high / 100


def tracking_stages() -> dict:
    """How far along the route the parcel is drawn at each stage of a shipment, and how long a
    stage that has no end time of its own is taken to last.

    TRACKING_PROGRESS_PICKED (default 0-5), TRACKING_PROGRESS_TRANSIT (5-85) and
    TRACKING_PROGRESS_DROPOFF (85-98) are percentages of the route;
    TRACKING_PICKED_HOURS (6) and TRACKING_DROPOFF_HOURS (8) are durations."""
    return {
        "picked": _percent_range("TRACKING_PROGRESS_PICKED", (0, 5)),
        "in_transit": _percent_range("TRACKING_PROGRESS_TRANSIT", (5, 85)),
        "dropping_off": _percent_range("TRACKING_PROGRESS_DROPOFF", (85, 98)),
        "picked_hours": max(1, _number("TRACKING_PICKED_HOURS", 6)),
        "dropping_off_hours": max(1, _number("TRACKING_DROPOFF_HOURS", 8)),
    }


def map_origin_point() -> tuple[float, float] | None:
    """Where the store is on the map (BITESHIP_ORIGIN_LAT, BITESHIP_ORIGIN_LNG). Unset: the
    store's postal code is looked up instead, which gives the middle of its district or city."""
    try:
        lat, lng = float(os.environ.get("BITESHIP_ORIGIN_LAT", "")), float(os.environ.get("BITESHIP_ORIGIN_LNG", ""))
    except ValueError:
        return None
    return (lat, lng) if -90 <= lat <= 90 and -180 <= lng <= 180 else None


def nominatim_url() -> str | None:
    """Geocoder that turns a district or city name into a point (NOMINATIM_URL, default the
    public OpenStreetMap one). Set it to an empty value to switch geocoding off."""
    return os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org").strip().rstrip("/") or None


def osrm_url() -> str | None:
    """Router that draws the road between two points (OSRM_URL, default the public demo
    server). Set it to an empty value to switch routes off."""
    return os.environ.get("OSRM_URL", "https://router.project-osrm.org").strip().rstrip("/") or None


def map_user_agent() -> str:
    """How this application names itself to the geocoder and the router. OpenStreetMap's usage
    policy asks for the application's name and a way to reach its operator: MAP_CONTACT (an
    email address or a URL), by default the shop's own address."""
    contact = os.environ.get("MAP_CONTACT", "").strip() or "https://byaurelle.vercel.app"
    return f"AurelleShop/1.0 ({contact})"


def geo_retry_days() -> int:
    """After how many days an area the geocoder could not find is looked up again
    (GEO_RETRY_DAYS, default 7)."""
    return max(1, _number("GEO_RETRY_DAYS", 7))


def database_url() -> str:
    """Postgres connection string.

    DATABASE_URL points at Supabase (Dashboard > Connect > "Transaction pooler", port 6543: the
    one meant for one-connection-per-request and serverless hosts). Without it, the local
    Postgres from docker-compose is used, with the password from .env."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    # 5433 is where docker-compose publishes Postgres on this machine.
    return f"postgresql://aurelle:{quote(os.environ['POSTGRES_PASSWORD'], safe='')}@127.0.0.1:5433/aurelle"


def media_dir() -> str:
    """Folder served at /media outside production (defaults to the shop's public media)."""
    return os.environ.get("MEDIA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "web", "ecommerce", "public", "media"))
