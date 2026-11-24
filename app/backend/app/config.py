import os
from pathlib import Path

# Local development: pick up the repository's .env (MySQL passwords) so the backend starts
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


def db_settings() -> dict:
    """MySQL connection settings. The password has no default: it comes from the environment or .env."""
    return {
        "host": os.environ.get("DB_HOST", "127.0.0.1"),
        # 3311 is where docker-compose publishes MySQL on this machine.
        "port": int(os.environ.get("DB_PORT", "3311")),
        "user": os.environ.get("DB_USER", "aurelle"),
        "password": os.environ.get("DB_PASSWORD") or os.environ["MYSQL_PASSWORD"],
        "database": os.environ.get("DB_NAME", "aurelle"),
    }


def media_dir() -> str:
    """Folder served at /media outside production (defaults to the shop's public media)."""
    return os.environ.get("MEDIA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "web", "ecommerce", "public", "media"))
