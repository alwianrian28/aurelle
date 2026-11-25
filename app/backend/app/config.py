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
    """Midtrans client key: public, handed to the shop to load the Snap popup."""
    return os.environ.get("MIDTRANS_CLIENT_KEY", "").strip() or None


def midtrans_is_production() -> bool:
    """Sandbox unless MIDTRANS_IS_PRODUCTION=true. Sandbox keys start with "SB-"."""
    return os.environ.get("MIDTRANS_IS_PRODUCTION", "").strip().lower() == "true"


def midtrans_own_card_form() -> bool:
    """Whether cards are paid in the shop's own card form (the default) or in Midtrans' form
    (MIDTRANS_CARD_FORM=midtrans). QRIS always uses Midtrans' form."""
    return os.environ.get("MIDTRANS_CARD_FORM", "own").strip().lower() != "midtrans"


def midtrans_notification_url() -> str | None:
    """Where Midtrans sends payment notifications for transactions created here. Sent with
    every transaction, so it wins over the URL saved in the Midtrans dashboard: payments started
    from a developer's machine still notify the deployed site. Set it to an empty value to fall
    back to the dashboard setting."""
    return os.environ.get("MIDTRANS_NOTIFICATION_URL", "https://byaurelle.vercel.app/api/payments/midtrans/notification").strip() or None


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
